/**
 * Authentik API client for managing applications and providers
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
import axios from 'axios';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
var AuthentikClient = /** @class */ (function () {
    function AuthentikClient() {
        this.config = this.loadConfig();
        this.client = axios.create({
            baseURL: "".concat(this.config.baseUrl, "/api/v3"),
            headers: {
                'Authorization': "Bearer ".concat(this.config.token),
                'Content-Type': 'application/json',
            },
        });
    }
    AuthentikClient.prototype.loadConfig = function () {
        try {
            // Try to load from encrypted env file using SOPS
            var repoDir = join(homedir(), 'Documents', 'mj-infra-flux');
            var encryptedFile = join(repoDir, '.env.secret.mcp-authentik.encrypted');
            var ageKeyFile = join(repoDir, 'home-infra-private.agekey');
            // Decrypt using SOPS
            var decrypted = execSync("SOPS_AGE_KEY_FILE=\"".concat(ageKeyFile, "\" sops decrypt --input-type dotenv --output-type dotenv \"").concat(encryptedFile, "\""), { encoding: 'utf8' });
            var config_1 = {
                baseUrl: '',
                token: '',
            };
            // Parse the decrypted env content
            decrypted.split('\n').forEach(function (line) {
                var _a = line.split('='), key = _a[0], valueParts = _a.slice(1);
                var value = valueParts.join('=').trim();
                if (key === 'AUTHENTIK_BASE_URL') {
                    config_1.baseUrl = value;
                }
                else if (key === 'AUTHENTIK_TOKEN') {
                    config_1.token = value;
                }
            });
            if (!config_1.baseUrl || !config_1.token) {
                throw new Error('Missing AUTHENTIK_BASE_URL or AUTHENTIK_TOKEN in encrypted config');
            }
            return config_1;
        }
        catch (error) {
            throw new Error("Failed to load Authentik config: ".concat(error));
        }
    };
    /**
     * Create a Proxy Provider for Home Assistant
     */
    AuthentikClient.prototype.createProxyProvider = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var providerData, response;
            var _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = {
                            name: options.name
                        };
                        return [4 /*yield*/, this.getDefaultAuthorizationFlow()];
                    case 1:
                        _a.authorization_flow = _c.sent();
                        return [4 /*yield*/, this.getInvalidationFlow()];
                    case 2:
                        providerData = (_a.invalidation_flow = _c.sent(),
                            _a.external_host = options.externalHost,
                            _a.internal_host = options.internalHost,
                            _a.internal_host_ssl_validation = (_b = options.internalHostSslValidation) !== null && _b !== void 0 ? _b : false,
                            _a.mode = options.forwardAuthMode ? 'forward_domain' : 'forward_single',
                            _a.access_token_validity = 'hours=24',
                            _a);
                        return [4 /*yield*/, this.client.post('/providers/proxy/', providerData)];
                    case 3:
                        response = _c.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Get invalidation flow
     */
    AuthentikClient.prototype.getInvalidationFlow = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, flows, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get('/flows/instances/?designation=invalidation')];
                    case 1:
                        response = _a.sent();
                        flows = response.data.results;
                        if (flows.length === 0) {
                            throw new Error('No invalidation flow found');
                        }
                        return [2 /*return*/, flows[0].pk];
                    case 2:
                        error_1 = _a.sent();
                        throw new Error("Failed to get invalidation flow: ".concat(error_1));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create an Application
     */
    AuthentikClient.prototype.createApplication = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var appData, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        appData = {
                            name: options.name,
                            slug: options.slug,
                            provider: options.providerId,
                            meta_launch_url: '',
                            group: options.group || '',
                        };
                        return [4 /*yield*/, this.client.post('/core/applications/', appData)];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data];
                }
            });
        });
    };
    /**
     * Get default authorization flow
     */
    AuthentikClient.prototype.getDefaultAuthorizationFlow = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, flows, implicitFlow, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.client.get('/flows/instances/?designation=authorization')];
                    case 1:
                        response = _a.sent();
                        flows = response.data.results;
                        implicitFlow = flows.find(function (f) {
                            return f.slug.includes('implicit') || f.name.toLowerCase().includes('implicit');
                        });
                        if (implicitFlow) {
                            return [2 /*return*/, implicitFlow.pk];
                        }
                        // Fallback to first authorization flow
                        if (flows.length > 0) {
                            return [2 /*return*/, flows[0].pk];
                        }
                        throw new Error('No authorization flow found');
                    case 2:
                        error_2 = _a.sent();
                        throw new Error("Failed to get authorization flow: ".concat(error_2));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create Home Assistant proxy application (complete setup)
     */
    AuthentikClient.prototype.createHomeAssistantApp = function () {
        return __awaiter(this, void 0, void 0, function () {
            var provider, app, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.createProxyProvider({
                                name: 'Home Assistant Provider',
                                externalHost: 'https://ha.nerdsbythehour.com',
                                internalHost: 'https://192.168.68.20:8123',
                                internalHostSslValidation: false, // Self-signed cert on HA
                                forwardAuthMode: true, // Forward auth at domain level
                            })];
                    case 1:
                        provider = _a.sent();
                        console.log("\u2705 Created provider with ID: ".concat(provider.pk));
                        return [4 /*yield*/, this.createApplication({
                                name: 'Home Assistant',
                                slug: 'homeassistant',
                                providerId: provider.pk,
                            })];
                    case 2:
                        app = _a.sent();
                        console.log("\u2705 Created application with slug: ".concat(app.slug));
                        return [2 /*return*/, {
                                provider: provider,
                                application: app,
                                urls: {
                                    app: "".concat(this.config.baseUrl, "/if/admin/#/core/applications/").concat(app.slug),
                                    provider: "".concat(this.config.baseUrl, "/if/admin/#/core/providers/").concat(provider.pk),
                                },
                            }];
                    case 3:
                        error_3 = _a.sent();
                        throw new Error("Failed to create Home Assistant app: ".concat(error_3.message || error_3));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * List all applications
     */
    AuthentikClient.prototype.listApplications = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.get('/core/applications/')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.results];
                }
            });
        });
    };
    /**
     * List all providers
     */
    AuthentikClient.prototype.listProviders = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.get('/providers/all/')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.results];
                }
            });
        });
    };
    /**
     * List all outposts
     */
    AuthentikClient.prototype.listOutposts = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.client.get('/outposts/instances/')];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.data.results];
                }
            });
        });
    };
    /**
     * Get embedded outpost (usually the first one)
     */
    AuthentikClient.prototype.getEmbeddedOutpost = function () {
        return __awaiter(this, void 0, void 0, function () {
            var outposts, embeddedOutpost;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.listOutposts()];
                    case 1:
                        outposts = _a.sent();
                        embeddedOutpost = outposts.find(function (o) {
                            return o.name.toLowerCase().includes('embedded') || o.managed === 'goauthentik.io/outposts/embedded';
                        });
                        if (!embeddedOutpost) {
                            throw new Error('No embedded outpost found');
                        }
                        return [2 /*return*/, embeddedOutpost];
                }
            });
        });
    };
    /**
     * Bind a provider to an outpost
     */
    AuthentikClient.prototype.bindProviderToOutpost = function (providerId, outpostId) {
        return __awaiter(this, void 0, void 0, function () {
            var outpost, _a, currentProviders, response, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        if (!outpostId) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.client.get("/outposts/instances/".concat(outpostId, "/")).then(function (r) { return r.data; })];
                    case 1:
                        _a = _b.sent();
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, this.getEmbeddedOutpost()];
                    case 3:
                        _a = _b.sent();
                        _b.label = 4;
                    case 4:
                        outpost = _a;
                        currentProviders = outpost.providers || [];
                        if (!!currentProviders.includes(providerId)) return [3 /*break*/, 6];
                        currentProviders.push(providerId);
                        return [4 /*yield*/, this.client.patch("/outposts/instances/".concat(outpost.pk, "/"), {
                                providers: currentProviders,
                            })];
                    case 5:
                        response = _b.sent();
                        return [2 /*return*/, response.data];
                    case 6: return [2 /*return*/, outpost];
                    case 7:
                        error_4 = _b.sent();
                        throw new Error("Failed to bind provider to outpost: ".concat(error_4.message || error_4));
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create Home Assistant application and bind to outpost (complete setup)
     */
    AuthentikClient.prototype.createHomeAssistantAppComplete = function () {
        return __awaiter(this, void 0, void 0, function () {
            var result, outpost, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.createHomeAssistantApp()];
                    case 1:
                        result = _a.sent();
                        // Bind the provider to the embedded outpost
                        console.log("\uD83D\uDD17 Binding provider ".concat(result.provider.pk, " to embedded outpost..."));
                        return [4 /*yield*/, this.bindProviderToOutpost(result.provider.pk)];
                    case 2:
                        outpost = _a.sent();
                        console.log("\u2705 Provider bound to outpost: ".concat(outpost.name));
                        return [2 /*return*/, __assign(__assign({}, result), { outpost: {
                                    id: outpost.pk,
                                    name: outpost.name,
                                } })];
                    case 3:
                        error_5 = _a.sent();
                        throw new Error("Failed to create complete Home Assistant setup: ".concat(error_5.message || error_5));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return AuthentikClient;
}());
export { AuthentikClient };
