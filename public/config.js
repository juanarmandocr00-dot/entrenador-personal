/* Valores públicos de tu proyecto de Supabase (Settings > API).
   La "anon key" es pública por diseño: lo que protege tus datos son las políticas RLS de schema.sql.
   NUNCA pongas aquí la service_role key ni la llave de Anthropic. */
window.APP_CONFIG = {
  SUPABASE_URL: "https://qjtkasqztwbqrffewlzp.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_DRkSJqcctS9HinbEOopCkQ_Vx9Ad2He",
  IDLE_MINUTES: 120   // cierra sesión tras este tiempo sin usar la app; 0 lo desactiva
};
