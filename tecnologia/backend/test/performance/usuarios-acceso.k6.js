/* global __ENV */
import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';

const origen = __ENV.ORIGEN_VALIDACION || 'https://localhost:8443';
if (__ENV.VALIDATION_MODE !== 'true' || origen !== 'https://localhost:8443') {
  throw new Error('Se requiere la demostración HTTPS local de validación.');
}
const clave = ' frase ficticia de medición 001 ';
const api = origen + '/api/v1';
export const options = {
  scenarios: {
    serie: {executor:'per-vu-iterations', vus:1, iterations:2, maxDuration:'10s'},
    concurrencia_dos: {executor:'per-vu-iterations', vus:2, iterations:2, startTime:'10s', maxDuration:'15s'},
  },
  thresholds: {checks:['rate==1']},
  summaryTrendStats: ['count','min','med','p(95)','max'],
  discardResponseBodies: true,
};

const headers = {Origin: origen, 'Content-Type':'application/json'};
function iniciar(correo) {
  return http.post(api+'/sesiones', JSON.stringify({correo,contrasena:clave}), {
    headers, responseType:'text', tags:{operacion:'login_argon2id'},
  });
}

export function setup() {
  const marca = Date.now();
  return Array.from({length:2}, (_, i) => {
    const correo = 'caracterizacion-'+marca+'-'+i+'@example.invalid';
    const r = http.post(api+'/cuentas', JSON.stringify({
      correo, contrasena:clave, confirmacionContrasena:clave, nombreMostrar:'Medición ficticia',
      perfiles:['cliente'], politicaPrivacidadAceptada:true, politicaPrivacidadVersion:'001-v1',
    }), {headers:{...headers,'Idempotency-Key':'medicion-ficticia-'+marca+'-'+i}, tags:{operacion:'preparar_fixture'}});
    if (r.status !== 201) throw new Error('La cuenta ficticia no pudo crearse.');
    return correo;
  });
}

export default function (cuentas) {
  const correo = cuentas[(exec.vu.idInTest-1)%cuentas.length];
  const login = iniciar(correo);
  if (!check(login, {'login 200': r => r.status===200})) return;
  const {tokenAcceso, csrfToken} = login.json();
  const perfil = http.get(api+'/perfil', {headers:{Authorization:'Bearer '+tokenAcceso}, tags:{operacion:'autorizar_perfil'}});
  check(perfil, {'perfil 200':r=>r.status===200});
  const refresh = http.post(api+'/sesiones/renovacion',null,{headers:{Origin:origen,'X-CSRF-Token':csrfToken}, tags:{operacion:'renovar_sesion'}});
  check(refresh,{'renovación 200':r=>r.status===200});
}
