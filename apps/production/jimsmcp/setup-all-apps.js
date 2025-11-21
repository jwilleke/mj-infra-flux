/**
 * Setup all missing applications in Authentik with ForwardAuth proxy providers
 * Based on dev-notes.md requirements
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { AuthentikClient } from './src/authentik.js';
var APPS_TO_ADD = [
    {
        name: 'JimsWiki',
        slug: 'jimswiki',
        url: 'https://nerdsbythehour.com/jimswiki',
        group: 'mj',
        description: '38,004 pages wiki',
    },
    {
        name: 'TeslaMate',
        slug: 'teslamate',
        url: 'https://teslamate.nerdsbythehour.com',
        internalUrl: 'http://teslamate.teslamate.svc.cluster.local:4000',
        group: 'mj',
        description: 'Vehicle tracking',
    },
    {
        name: 'Grafana',
        slug: 'grafana',
        url: 'https://grafana.nerdsbythehour.com',
        internalUrl: 'http://grafana.monitoring.svc.cluster.local:3000',
        group: 'mj',
        description: 'Dashboards and monitoring',
    },
];
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var client, existingApps, existingSlugs_1, appsToCreate, _i, appsToCreate_1, appConfig, provider, app, error_1, finalApps, error_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    client = new AuthentikClient();
                    console.log('🔧 Setting up Authentik applications for ForwardAuth\n');
                    console.log('='.repeat(70));
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 12, , 13]);
                    // Step 1: List existing applications
                    console.log('\n1️⃣  Checking existing applications...\n');
                    return [4 /*yield*/, client.listApplications()];
                case 2:
                    existingApps = _c.sent();
                    existingSlugs_1 = existingApps.map(function (app) { return app.slug; });
                    console.log("   Found ".concat(existingApps.length, " existing applications:"));
                    existingApps.forEach(function (app) {
                        console.log("   \u2022 ".concat(app.name, " (").concat(app.slug, ")"));
                    });
                    appsToCreate = APPS_TO_ADD.filter(function (app) { return !existingSlugs_1.includes(app.slug); });
                    if (appsToCreate.length === 0) {
                        console.log('\n✅ All applications already exist!');
                        console.log('='.repeat(70) + '\n');
                        return [2 /*return*/];
                    }
                    console.log("\n   Will create ".concat(appsToCreate.length, " new applications:\n"));
                    appsToCreate.forEach(function (app) {
                        console.log("   \u2022 ".concat(app.name, " (").concat(app.slug, ") - ").concat(app.description));
                    });
                    // Step 2: Create providers and applications
                    console.log('\n2️⃣  Creating providers and applications...\n');
                    _i = 0, appsToCreate_1 = appsToCreate;
                    _c.label = 3;
                case 3:
                    if (!(_i < appsToCreate_1.length)) return [3 /*break*/, 10];
                    appConfig = appsToCreate_1[_i];
                    console.log("\n   Creating ".concat(appConfig.name, "..."));
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 8, , 9]);
                    return [4 /*yield*/, client.createProxyProvider({
                            name: "".concat(appConfig.name, " Provider"),
                            externalHost: appConfig.url,
                            internalHost: appConfig.internalUrl || appConfig.url,
                            internalHostSslValidation: false,
                            forwardAuthMode: true,
                        })];
                case 5:
                    provider = _c.sent();
                    console.log("   \u2705 Created provider (ID: ".concat(provider.pk, ")"));
                    return [4 /*yield*/, client.createApplication({
                            name: appConfig.name,
                            slug: appConfig.slug,
                            providerId: provider.pk,
                            group: appConfig.group,
                        })];
                case 6:
                    app = _c.sent();
                    console.log("   \u2705 Created application (slug: ".concat(app.slug, ")"));
                    // Bind provider to embedded outpost
                    return [4 /*yield*/, client.bindProviderToOutpost(provider.pk)];
                case 7:
                    // Bind provider to embedded outpost
                    _c.sent();
                    console.log("   \u2705 Bound provider to embedded outpost");
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _c.sent();
                    console.error("   \u274C Failed to create ".concat(appConfig.name, ":"), error_1.message);
                    if ((_a = error_1.response) === null || _a === void 0 ? void 0 : _a.data) {
                        console.error('   Details:', JSON.stringify(error_1.response.data, null, 2));
                    }
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 3];
                case 10:
                    // Step 3: Summary
                    console.log('\n3️⃣  Verifying final application list...\n');
                    return [4 /*yield*/, client.listApplications()];
                case 11:
                    finalApps = _c.sent();
                    console.log("   Total applications: ".concat(finalApps.length, "\n"));
                    finalApps.forEach(function (app) {
                        console.log("   \u2022 ".concat(app.name, " (").concat(app.slug, ")"));
                        if (app.group) {
                            console.log("     Group: ".concat(app.group));
                        }
                    });
                    console.log('\n' + '='.repeat(70));
                    console.log('📋 NEXT STEPS');
                    console.log('='.repeat(70));
                    console.log('\n📝 For each application, you need to:');
                    console.log('   1. Create a Traefik middleware for ForwardAuth');
                    console.log('   2. Update the ingress to use the middleware');
                    console.log('   3. Configure application-specific settings in Authentik UI');
                    console.log('\n🔒 Example Traefik Middleware (adjust namespace):');
                    console.log('-'.repeat(70));
                    console.log("\napiVersion: traefik.io/v1alpha1\nkind: Middleware\nmetadata:\n  name: authentik-forwardauth\n  namespace: <APP_NAMESPACE>\nspec:\n  forwardAuth:\n    address: http://authentik-server.authentik.svc.cluster.local:9000/outpost.goauthentik.io/auth/traefik\n    trustForwardHeader: true\n    authResponseHeaders:\n      - X-authentik-username\n      - X-authentik-groups\n      - X-authentik-email\n      - X-authentik-name\n      - X-authentik-uid\n");
                    console.log('-'.repeat(70));
                    console.log('\n📌 Example Ingress Annotation:');
                    console.log("   traefik.ingress.kubernetes.io/router.middlewares: <NAMESPACE>-authentik-forwardauth@kubernetescrd");
                    console.log('\n💡 To configure group-based access (mj group):');
                    console.log('   1. Go to Authentik Admin UI');
                    console.log('   2. Navigate to Applications → Select app');
                    console.log('   3. Set Policy Bindings to require "mj" group membership');
                    console.log('\n' + '='.repeat(70) + '\n');
                    return [3 /*break*/, 13];
                case 12:
                    error_2 = _c.sent();
                    console.error('❌ Error:', error_2.message);
                    if ((_b = error_2.response) === null || _b === void 0 ? void 0 : _b.data) {
                        console.error('Details:', JSON.stringify(error_2.response.data, null, 2));
                    }
                    process.exit(1);
                    return [3 /*break*/, 13];
                case 13: return [2 /*return*/];
            }
        });
    });
}
main();
