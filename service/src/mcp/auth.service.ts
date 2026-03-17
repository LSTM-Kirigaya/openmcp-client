import { createServer } from 'node:http';
import { URL } from 'node:url';
import { OAuthClientInformation, OAuthClientInformationFull, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';
import { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import open from 'open';
import { sanitizeUrl } from 'strict-url-sanitise';

// const CALLBACK_PORT = 16203; // Use different port than auth server (3001)
// const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

/**
 * @description 内存中的OAuth客户端提供者
 */
class InMemoryOAuthClientProvider implements OAuthClientProvider {
  private _clientInformation?: OAuthClientInformationFull;
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;

  constructor(
    private readonly _redirectUrl: string | URL,
    private readonly _clientMetadata: OAuthClientMetadata,
    onRedirect?: (url: URL) => void
  ) {
    this._onRedirect = onRedirect || ((url) => {
      console.log(`Redirect to: ${url.toString()}`);
    });
  }

  private _onRedirect: (url: URL) => void;

  get redirectUrl(): string | URL {
    return this._redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return this._clientMetadata;
  }

  clientInformation(): OAuthClientInformation | undefined {
    return this._clientInformation;
  }

  saveClientInformation(clientInformation: OAuthClientInformationFull): void {
    this._clientInformation = clientInformation;
  }

  tokens(): OAuthTokens | undefined {
    return this._tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    this._tokens = tokens;
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    this._onRedirect(authorizationUrl);
  }

  saveCodeVerifier(codeVerifier: string): void {
    this._codeVerifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error('No code verifier saved');
    }
    return this._codeVerifier;
  }
}


export class OAuthClient {
  port: number;
  callbackUrl: string;

  constructor() {
    // console.log('🔐 Initializing OAuth client...');
    // 初始化OAuth客户端
    this.port = Math.floor(Math.random() * (50000 - 40000 + 1)) + 40000;
    //TODO: 如果端口被占用，重新生成一个端口
    this.callbackUrl = `http://localhost:${this.port}/callback`;

  }
  /**
   * @description 开启本地服务器上，并监听OAuth回调请求，并解析授权码或错误信息
   * @returns {Promise<string>} 返回授权码
   * @throws {Error} 如果没有收到授权码或发生错误
   */

  public async waitForOAuthCallback(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const server = createServer((req, res) => {
        // Ignore favicon requests
        if (req.url === '/favicon.ico') {
          res.writeHead(404);
          res.end();
          return;
        }

        console.log(`📥 Received callback: ${req.url}`);
        const parsedUrl = new URL(req.url || '', 'http://localhost');
        const code = parsedUrl.searchParams.get('code');
        const error = parsedUrl.searchParams.get('error');

        if (code) {
          console.log(`✅ Authorization code received: ${code?.substring(0, 10)}...`);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
          <html>
            <body>
              <h1>Authorization Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
              <script>setTimeout(() => window.close(), 2000);</script>
            </body>
          </html>
        `);

          resolve(code);
          setTimeout(() => server.close(), 3000);
        } else if (error) {
          console.log(`❌ Authorization error: ${error}`);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
          <html>
            <body>
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
            </body>
          </html>
        `);
          reject(new Error(`OAuth authorization failed: ${error}`));
        } else {
          console.log(`❌ No authorization code or error in callback`);
          res.writeHead(400);
          res.end('Bad request');
          reject(new Error('No authorization code provided'));
        }
      });

      server.listen(this.port, () => {
        console.log(`OAuth callback server started on http://localhost:${this.port}`);
      });
    });
  }



  /**
   * @description 获取Oauth认证provider
   * @return {Promise<OAuthClientProvider>} 返回一个OAuthClientProvider实例
   */
  public async getOAuthProvider(): Promise<OAuthClientProvider> {

    const clientMetadata: OAuthClientMetadata = {
      client_name: 'Simple OAuth MCP Client',
      redirect_uris: [this.callbackUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      logo_uri: undefined,
      tos_uri: undefined,
    };

    // console.log('🔐 Creating OAuth provider...');
    const oauthProvider = new InMemoryOAuthClientProvider(
      this.callbackUrl,
      clientMetadata,
      (redirectUrl: URL) => {
        console.log(`📌 OAuth redirect handler called - opening browser`);
        console.log(`Opening browser to: ${redirectUrl.toString()}`);
        this.openBrowser(redirectUrl.toString());
      }
    );
    // console.log('🔐 OAuth provider created');
    return oauthProvider;
  }

  /**
   * @description 打开浏览器
   * @param url 授权URL
   */

  public async openBrowser(url: string): Promise<void> {
    console.log(`🌐 Opening browser for authorization: ${url}`);
    await open(sanitizeUrl(url)); // 自动适配不同操作系统
  }
}


