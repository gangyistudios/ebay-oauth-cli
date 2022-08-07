const https = require('https');
const fs = require('fs');
const url = require('url');
const openUrl = require('open');
const EbayAuthToken = require('ebay-oauth-nodejs-client');
require('dotenv').config()

// Read env variables 
const isDebug = process.env.PRODUCTION != 'true';
const isAppToken = process.env.APP_TOKEN == 'true';

// Hostname in eBay redirectUri (https://developer.ebay.com/my/auth/) 
// needs to be configured in /etc/hosts to point to localhost
// Port needs to match that set up in your eBay redirectUri
// See README.md for more info
const hostname = 'localhost';
const port = 3000;

// TODO: Update these scopes to the ones required by your app
// See https://developer.ebay.com/api-docs/static/oauth-scopes.html
const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.marketing.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.marketing',
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment'
];

function main() {
    // Initial Ebay Oauth node client 
    let ebayAuthClient = new EbayAuthToken({
        filePath: 'ebay-config.json'
    });

    if (isAppToken) {
        clientCredentialFlow(ebayAuthClient);
    } else {
        authorizationCodeFlow(ebayAuthClient);
    }
}

// If only Client Credential Flow is required, then no user authorisation is required, 
// hence no server listener is needed. 
function clientCredentialFlow(ebayAuthClient) {
    const clientScope = 'https://api.ebay.com/oauth/api_scope';
    ebayAuthClient.getApplicationToken(isDebug ? 'SANDBOX' : 'PRODUCTION', clientScope).then((data) => {
        console.log(JSON.parse(data));
        process.exit(0);
    }).catch((error) => {
        console.log(`Error to get Access token :${JSON.stringify(error)}`);
        process.exit(1);
    });
}

// For Authorization Code Flow, we require the user's consent, which they provide by logging
// in. So we need to set up a server listener at our callback url (set up redirectin eBay here:
// https://developer.ebay.com/my/auth/ - see README.md for screenshot )
function authorizationCodeFlow(ebayAuthClient) {
    // Start server listener
    initServer(ebayAuthClient);

    // Accepts optional values: prompt, state
    let authUrl = ebayAuthClient.generateUserAuthorizationUrl(isDebug ? 'SANDBOX' : 'PRODUCTION', scopes, { prompt: 'login', state: 'custom-state-value' });
    // Open the auth url for user authorization, the resulting call back url will 
    // directed at our listening server. 
    openUrl(authUrl)
}

// Starts a HTTPS server listening on https://localhost:3000/api, once it receives a request 
// it will parse the access_token, refresh_token and expiry time. 
// As eBay requires a proper url, add a line to /etc/hosts to redirect local.host to localhost.
// See README.md for instructions.
function initServer(ebayAuthClient) {
    // Load certs
    const options = {
        key: fs.readFileSync('key.pem'),
        cert: fs.readFileSync('cert.pem')
    };

    // Create HTTPS server that listens for the callback from eBay and parses the code/displays error.
    https.createServer(options, function (req, res) {
        var parsed_url = url.parse(req.url, true);
        // Get the code
        if (parsed_url.pathname == '/api') {
            // Send response back to browser
            res.writeHead(200);
            res.end("This browser window can be closed now\n");

            // Exchange code for user token and display
            let code = parsed_url.query.code;
            ebayAuthClient.exchangeCodeForAccessToken(isDebug ? 'SANDBOX' : 'PRODUCTION', code).then((data) => {
                console.log(JSON.parse(data));
                process.exit(0);
            }).catch((error) => {
                console.log(error);
                console.log(`Error getting Access token :${JSON.stringify(error)}`);
                process.exit(1);
            });
        }
    }).listen(port);

    console.log(`Waiting for response at https://${hostname}:${port}/`);
}

if (require.main === module) {
    main();
}