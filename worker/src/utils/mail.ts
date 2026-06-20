/**
 * Envía un correo electrónico con el Magic Link utilizando la API de Resend.
 * En entorno local o si falta la clave API, se redirige el link a la consola.
 */
export async function sendMagicLink(
  email: string,
  url: string,
  env: { RESEND_API_KEY?: string; ENVIRONMENT?: string }
): Promise<{ success: boolean; delivered: boolean; error?: string }> {
  // Imprimir siempre en logs para wrangler tail / depuración
  console.log(`[MAGIC LINK] Enlace para ${email}: ${url}`);

  const isLocal = env.ENVIRONMENT === "local";

  if (!env.RESEND_API_KEY) {
    if (isLocal) {
      return { success: true, delivered: false };
    }
    return {
      success: false,
      delivered: false,
      error: "RESEND_API_KEY no configurado en las variables de entorno.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Mi Despensa <no-reply@biteradigital.com>",
        to: [email],
        subject: "Tu enlace de acceso a Mi Despensa",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #333;">¡Hola!</h2>
            <p style="color: #666; line-height: 1.6;">Para ingresar a tu cuenta en <strong>Mi Despensa</strong>, haz clic en el siguiente botón:</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${url}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Iniciar Sesión</a>
            </div>
            <p style="color: #999; font-size: 12px;">Este enlace es temporal y vencerá en 10 minutos. Si no solicitaste este correo, puedes ignorarlo con seguridad.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 11px; text-align: center;">Bitera Digital SAS — Mi Despensa</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        delivered: false,
        error: `Error de API de Resend (${response.status}): ${errorText}`,
      };
    }

    return { success: true, delivered: true };
  } catch (err: any) {
    return {
      success: false,
      delivered: false,
      error: `Error de red al conectar con Resend: ${err.message}`,
    };
  }
}
