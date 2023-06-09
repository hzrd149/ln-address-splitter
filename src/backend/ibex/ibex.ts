import debug from "debug";
import { LightningBackend } from "../type.js";
import { msatsToSats } from "../../helpers/sats.js";

export type AuthData = {
  email?: string;
  password?: string;
  accessToken?: string;
  accessTokenExpiresAt?: Date;
  refreshToken?: string;
  refreshTokenExpiresAt?: Date;
};

export class IBEXBackend implements LightningBackend {
  baseUrl: string = "https://ibexhub.ibexmercado.com";
  accountId: string;

  auth: AuthData;
  private log = debug("prism:ibex");

  constructor(accountId: string, auth: AuthData) {
    this.accountId = accountId;
    this.auth = auth;
  }

  async setup() {
    const result = await this.requestWithAuth(`/v2/account/${this.accountId}`);

    this.log(
      `Connected to IBEX account "${result.name}" with ${msatsToSats(
        result.balance
      )} sats`
    );
  }

  private async request<T extends Object = any>(
    url: string,
    init?: RequestInit
  ) {
    const fullUrl = new URL(url, this.baseUrl);
    const headers = {
      ...init?.headers,
      Accept: "application/json",
      "User-Agent": "NodeJS",
    };

    if (init.body) {
      headers["Content-Type"] = "application/json";
    }

    return fetch(fullUrl, {
      ...init,
      headers,
    }).then(async (res) => {
      if (res.headers.get("content-type").includes("application/json")) {
        const json: T | { Error: string } = await res.json();

        if (Object.hasOwn(json, "Error") || Object.hasOwn(json, "error")) {
          //@ts-ignore
          throw new Error(`IBEX API: ${json.Error || json.error}`);
        }

        return json as T;
      } else throw new Error("Expected JSON");
    });
  }
  private async requestWithAuth<T extends Object = any>(
    url: string,
    init?: RequestInit
  ) {
    if (!this.accessToken) await this.refreshAccessToken();

    console.log(this.auth);

    return this.request<T>(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: this.accessToken,
      },
    });
  }

  get accessToken(): string | undefined {
    return this.auth.accessTokenExpiresAt < new Date()
      ? undefined
      : this.auth.accessToken;
  }
  get refreshToken(): string | undefined {
    return this.auth.refreshTokenExpiresAt < new Date()
      ? undefined
      : this.auth.refreshToken;
  }

  private async refreshAccessToken() {
    // refresh token expired or login again
    if (!this.auth.refreshToken) {
      if (!this.auth.email || !this.auth.password)
        throw new Error("Missing email and password");

      const {
        accessToken,
        accessTokenExpiresAt,
        refreshToken,
        refreshTokenExpiresAt,
      } = await this.request("/auth/signin", {
        method: "POST",
        body: JSON.stringify({
          email: this.auth.email,
          password: this.auth.password,
        }),
      });

      this.log("Got access and refresh tokens");
      this.auth.accessToken = accessToken;
      this.auth.accessTokenExpiresAt = new Date(accessTokenExpiresAt * 1000);
      this.auth.refreshToken = refreshToken;
      this.auth.refreshTokenExpiresAt = new Date(refreshTokenExpiresAt * 1000);

      return this.accessToken;
    }

    // accessToken missing or expired
    if (!this.auth.accessToken) {
      const result = await this.request("/auth/refresh-access-token", {
        method: "POST",
        body: JSON.stringify({ refreshToken: this.auth.refreshToken }),
      });

      this.log("Got new access token");
      this.auth.accessToken = result.accessToken as string;
      this.auth.accessTokenExpiresAt = new Date(result.expiresAt * 1000);
    }

    return this.auth.accessToken;
  }

  async createInvoice(amount: number, description?: string, webhook?: string) {
    const result = await this.requestWithAuth("/v2/invoice/add", {
      method: "POST",
      body: JSON.stringify({
        amount,
        accountId: this.accountId,
        memo: description,
        webhookUrl: webhook,
      }),
    });

    return {
      paymentRequest: result.invoice.bolt11 as string,
      paymentHash: result.invoice.hash as string,
    };
  }

  async payInvoice(invoice: string) {
    const result = await this.requestWithAuth("/v2/invoice/pay", {
      method: "POST",
      body: JSON.stringify({
        bolt11: invoice,
        accountId: this.accountId,
      }),
    });

    return {
      paymentHash: result.transaction.payment.hash as string,
      fee: result.transaction.payment.feeMsat as number,
    };
  }

  async checkInvoiceComplete(hash: string): Promise<boolean> {
    return false;
  }
  async checkPaymentComplete(hash: string): Promise<boolean> {
    return false;
  }
}
