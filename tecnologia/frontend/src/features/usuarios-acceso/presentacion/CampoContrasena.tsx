import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from 'react';

type Props = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & { etiqueta: string };

export function CampoContrasena({ etiqueta, id, disabled, ...entrada }: Props) {
  const generado = useId();
  const campo = id ?? generado;
  const input = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const formulario = input.current?.form;
    const ocultar = () => setVisible(false);
    formulario?.addEventListener('reset', ocultar);
    return () => formulario?.removeEventListener('reset', ocultar);
  }, []);

  return <div className="campo-contrasena">
    <label htmlFor={campo}>{etiqueta}</label>
    <div className="entrada-contrasena">
      <input {...entrada} ref={input} id={campo} disabled={disabled} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className={visible ? 'ojo-control ojo-abierto' : 'ojo-control'}
        aria-label={`${visible ? 'Ocultar' : 'Mostrar'} el valor de «${etiqueta}»`}
        aria-controls={campo}
        disabled={disabled}
        onClick={() => setVisible(valor => !valor)}
      >
        <span className="ojo-icono" aria-hidden="true" />
      </button>
    </div>
  </div>;
}
