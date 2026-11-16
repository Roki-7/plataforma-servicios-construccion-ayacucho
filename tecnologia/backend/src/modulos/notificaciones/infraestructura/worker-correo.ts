import type { DataSource } from 'typeorm';
import type { TransporteCorreo } from '../aplicacion/puertos/correo-seguridad.js';
import type { CifradoOutbox } from './outbox.js';

interface Pendiente { id: string; destinatario: string; payload_cifrado: Buffer; key_id: string; intentos: number; vence_en: Date | null }
export class WorkerCorreo {
  private timer: ReturnType<typeof setInterval> | undefined;
  private trabajando: Promise<void> | undefined;
  private fallos = 0; private suspendidaHasta = 0;
  constructor(private readonly db: DataSource, private readonly cifrado: CifradoOutbox, private readonly smtp: TransporteCorreo) {}
  iniciar(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { if (!this.trabajando) { this.trabajando = this.paso().catch(() => undefined).finally(() => { this.trabajando = undefined; }); } }, 1000);
    this.timer.unref();
  }
  async detener(): Promise<void> { if (this.timer) clearInterval(this.timer); this.timer = undefined; await this.trabajando; }
  async paso(): Promise<void> {
    if (!this.db.isInitialized || Date.now() < this.suspendidaHasta) return;
    await this.db.query("UPDATE avisos_pendientes SET estado='vencido',payload_cifrado=NULL,lease_hasta=NULL WHERE vence_en<=clock_timestamp() AND estado IN ('pendiente','enviando')");
    await this.db.query("UPDATE avisos_pendientes SET estado='fallido',payload_cifrado=NULL,lease_hasta=NULL,error_sanitizado='ENTREGA_NO_CONFIRMADA' WHERE estado='enviando' AND intentos>=8 AND lease_hasta<clock_timestamp()");
    for (let i = 0; i < 5; i++) {
      const q = this.db.createQueryRunner(); let fila: Pendiente | undefined;
      try {
        await q.connect(); await q.startTransaction();
        const filas: Pendiente[] = await q.query(`SELECT id,destinatario,payload_cifrado,key_id,intentos,vence_en FROM avisos_pendientes
          WHERE payload_cifrado IS NOT NULL AND (vence_en IS NULL OR vence_en>clock_timestamp()) AND intentos<8 AND proximo_intento_en<=clock_timestamp()
          AND (estado='pendiente' OR (estado='enviando' AND lease_hasta<clock_timestamp())) FOR UPDATE SKIP LOCKED LIMIT 1`);
        fila = filas[0];
        if (fila) await q.query("UPDATE avisos_pendientes SET estado='enviando',intentos=intentos+1,lease_hasta=clock_timestamp()+interval '30 seconds' WHERE id=$1", [fila.id]);
        await q.commitTransaction();
      } catch (error) { if (q.isTransactionActive) await q.rollbackTransaction(); throw error; }
      finally { await q.release(); }
      if (!fila) return;
      try {
        if (fila.vence_en && fila.vence_en.getTime() <= Date.now()) { await this.db.query("UPDATE avisos_pendientes SET estado='vencido',payload_cifrado=NULL,lease_hasta=NULL WHERE id=$1", [fila.id]); continue; }
        const payload = this.cifrado.descifrar(fila.id, fila.destinatario, fila.key_id, fila.payload_cifrado);
        await this.smtp.enviar({ id: fila.id, destinatario: fila.destinatario, ...payload });
        await this.db.query("UPDATE avisos_pendientes SET estado='enviado',enviado_en=clock_timestamp(),payload_cifrado=NULL,lease_hasta=NULL,error_sanitizado=NULL WHERE id=$1", [fila.id]);
        this.fallos = 0;
      } catch {
        const espera = Math.min(300, 2 ** (fila.intentos + 1));
        await this.db.query(`UPDATE avisos_pendientes SET estado=CASE WHEN intentos>=8 THEN 'fallido' ELSE 'pendiente' END,
          payload_cifrado=CASE WHEN intentos>=8 THEN NULL ELSE payload_cifrado END, lease_hasta=NULL,error_sanitizado='SMTP_NO_DISPONIBLE',proximo_intento_en=clock_timestamp()+($2::integer*interval '1 second') WHERE id=$1`, [fila.id, espera]);
        if (++this.fallos >= 3) { this.suspendidaHasta = Date.now() + 30000; return; }
      }
    }
  }
}
