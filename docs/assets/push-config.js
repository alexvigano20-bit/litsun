// Servizio notifiche a app chiusa (Supabase Edge Function "litsun-push").
// Contiene solo l'indirizzo pubblico: nessuna chiave privata nel frontend.
// Lascia endpoint vuoto per pubblicare una copia senza notifiche dirette.
const LITSUN_PUSH = {
  endpoint: 'https://uwerzyyamokvbjozigyj.supabase.co/functions/v1/litsun-push',
  windowDays: 35
};
