/*
 * Copyright 2020 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import GithubIcon from '@material-ui/icons/AcUnit';
import { DefaultAuthConnector } from '../../lib/AuthConnector';
import { GithubSession } from './types';
import { OAuthApi } from '../../../definitions/auth';
import { OAuthRequestApi, AuthProvider } from '../../../definitions';
import { SessionManager } from '../../lib/AuthSessionManager/types';
import { RefreshingAuthSessionManager } from '../../lib/AuthSessionManager';

type CreateOptions = {
  // TODO(Rugvip): These two should be grabbed from global config when available, they're not unique to GithubAuth
  apiOrigin: string;
  basePath: string;

  oauthRequestApi: OAuthRequestApi;

  environment?: string;
  provider?: AuthProvider & { id: string };
};

export type GithubAuthResponse = {
  accessToken: string;
  idToken: string;
  scope: string;
  expiresInSeconds: number;
};

const DEFAULT_PROVIDER = {
  id: 'github',
  title: 'Github',
  icon: GithubIcon,
};

class GithubAuth implements OAuthApi {
  static create({
    apiOrigin,
    basePath,
    environment = 'dev',
    provider = DEFAULT_PROVIDER,
    oauthRequestApi,
  }: CreateOptions) {
    const connector = new DefaultAuthConnector({
      apiOrigin,
      basePath,
      environment,
      provider,
      oauthRequestApi: oauthRequestApi,
      sessionTransform(res: GithubAuthResponse): GithubSession {
        return {
          idToken: res.idToken,
          accessToken: res.accessToken,
          scopes: GithubAuth.normalizeScopes(res.scope),
          expiresAt: new Date(Date.now() + res.expiresInSeconds * 1000),
        };
      },
    });

    const sessionManager = new RefreshingAuthSessionManager({
      connector,
      defaultScopes: new Set(['user']),
      sessionScopes: session => session.scopes,
      sessionShouldRefresh: session => {
        const expiresInSec = (session.expiresAt.getTime() - Date.now()) / 1000;
        return expiresInSec < 60 * 5;
      },
    });

    return new GithubAuth(sessionManager);
  }

  constructor(private readonly sessionManager: SessionManager<GithubSession>) {}

  async getAccessToken(scope?: string | string[]) {
    const normalizedScopes = GithubAuth.normalizeScopes(scope);
    const session = await this.sessionManager.getSession({
      optional: false,
      scopes: normalizedScopes,
    });
    return session.accessToken;
  }

  async logout() {
    await this.sessionManager.removeSession();
  }

  static normalizeScopes(scopes?: string | string[]): Set<string> {
    if (!scopes) {
      return new Set();
    }

    const scopeList = Array.isArray(scopes)
      ? scopes
      : scopes.split(/[\s]/).filter(Boolean);

    return new Set(scopeList);
  }
}
export default GithubAuth;