/**
 * Imports every repo so its model is registered with Mongoose. Scripts that work on all collections
 * (`pnpm admin sync-indexes`) import this; the app registers models through the services it builds.
 */
import '../jobs/repo';
import '../modules/authTokens/repo';
import '../modules/brands/repo';
import '../modules/credits/repo';
import '../modules/emailLog/repo';
import '../modules/memberships/repo';
import '../modules/prompts/repo';
import '../modules/providerSpend/repo';
import '../modules/referrals/repo';
import '../modules/results/repo';
import '../modules/runs/repo';
import '../modules/schedules/repo';
import '../modules/sessions/repo';
import '../modules/shares/repo';
import '../modules/stripeEvents/repo';
import '../modules/surveys/repo';
import '../modules/users/repo';
import '../modules/workspaces/repo';
