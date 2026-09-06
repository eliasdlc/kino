import { defineApp } from 'convex/server';
import migrations from '@convex-dev/migrations/convex.config.js';

// Los componentes que el deployment monta junto a las funciones de Kino.
// `migrations` guarda el estado de cada migración (lote, cursor, si terminó),
// que es lo que permite reejecutarlas sin repetir trabajo y retomar una que
// murió a mitad. Las migraciones viven en `convex/migrations/`.
const app = defineApp();
app.use(migrations);

export default app;
