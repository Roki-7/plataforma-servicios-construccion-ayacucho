export interface EnvioCorreo { readonly id: string; readonly destinatario: string; readonly asunto: string; readonly texto: string }
export interface TransporteCorreo { enviar(correo: EnvioCorreo): Promise<void> }
