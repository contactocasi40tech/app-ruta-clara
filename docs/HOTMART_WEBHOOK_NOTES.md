# Notas oficiales para el webhook de Hotmart

Fuente principal: [Using webhook to get subscriptions data](https://developers.hotmart.com/docs/en/tutorials/use-webhook-for-subscriptions/).

Hotmart envía una credencial única de cuenta denominada **hottok** en el encabezado HTTP `X-HOTMART-HOTTOK`. El endpoint debe validarla antes de procesar el payload para impedir solicitudes fraudulentas. La documentación recomienda Webhook versión 2.0.0.

Para productos de suscripción, Hotmart documenta como eventos básicos `PURCHASE_APPROVED`, `PURCHASE_CANCELED` y `PURCHASE_DELAYED`. Los payloads incluyen el nombre del evento y objetos con información de suscripción, comprador y compra. El endpoint de Ruta Clara normalizará los identificadores y estados relevantes y rechazará eventos no autenticados.

## Configuración de Ruta Clara

La URL de producción es `https://ruta-clara.casi40tech.lat/api/webhooks/hotmart`. Debe configurarse con la versión 2.0.0. El servidor valida `X-HOTMART-HOTTOK`, acepta únicamente el Product ID configurado como secreto, limita el cuerpo JSON a 256 KB y no registra el token ni el payload completo.

Se procesan compras aprobadas o completas, boletos generados, compras canceladas, atrasadas, expiradas, reembolsadas, en contracargo o protestadas, además de cancelaciones de suscripción. Los demás eventos válidamente firmados se confirman como ignorados para evitar reintentos innecesarios.

Cada evento se registra por su `id` único. Los reintentos son idempotentes y los eventos anteriores al último aplicado se marcan como obsoletos. Una compra aprobada activa al usuario cuyo correo de Supabase coincide con el correo del comprador; los estados negativos lo bloquean. Si la compra llega antes del registro, la suscripción se vincula automáticamente cuando se crea la cuenta con el mismo correo.

| Respuesta | Significado |
| --- | --- |
| `200` | Evento procesado, duplicado, obsoleto o deliberadamente ignorado. |
| `400` | Payload soportado pero incompleto o inválido. |
| `401` | Hottok ausente o incorrecto. |
| `503` | Secretos del webhook no configurados. |
| `500` | Error transitorio de persistencia; Hotmart puede reintentar. |
