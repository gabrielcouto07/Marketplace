/**
 * Carregador do Google Identity Services (GIS) para obter um ID token real (`credential`) a partir do
 * botão "Continuar com Google". Só é usado quando o mock está desligado e NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * está definido; o script é injetado sob demanda (uma vez) e o token vai para `POST /auth/google`.
 */

const GSI_SRC = "https://accounts.google.com/gsi/client";

interface CredentialResponse {
  credential?: string;
  select_by?: string;
}

interface PromptMomentNotification {
  isDisplayed?: () => boolean;
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
  isDismissedMoment?: () => boolean;
  getDismissedReason?: () => string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
    ux_mode?: "popup" | "redirect";
  }) => void;
  prompt: (listener?: (notification: PromptMomentNotification) => void) => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

export type GoogleIdentityErrorCode = "SDK_UNAVAILABLE" | "PROMPT_UNAVAILABLE" | "NO_CREDENTIAL";

export class GoogleIdentityError extends Error {
  readonly code: GoogleIdentityErrorCode;

  constructor(code: GoogleIdentityErrorCode) {
    super(`Google Identity: ${code}`);
    this.name = "GoogleIdentityError";
    this.code = code;
  }
}

let loading: Promise<GoogleAccountsId> | null = null;

/** Injeta o script do GIS uma única vez e devolve `google.accounts.id`. */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (typeof window === "undefined") {
    return Promise.reject(new GoogleIdentityError("SDK_UNAVAILABLE"));
  }
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  if (!loading) {
    loading = new Promise<GoogleAccountsId>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const id = window.google?.accounts?.id;
        if (id) resolve(id);
        else {
          loading = null;
          reject(new GoogleIdentityError("SDK_UNAVAILABLE"));
        }
      };
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new GoogleIdentityError("SDK_UNAVAILABLE"));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/** Tempo máximo esperando o prompt: com FedCM o navegador não avisa quando ele foi suprimido. */
export const GOOGLE_PROMPT_TIMEOUT_MS = 15_000;

let initializedFor: string | null = null;
let pending: ((response: CredentialResponse) => void) | null = null;

/**
 * `initialize` é por página (o Google documenta uma única chamada); o callback fixo encaminha a
 * resposta para a solicitação em andamento.
 */
function ensureInitialized(id: GoogleAccountsId, clientId: string): void {
  if (initializedFor === clientId) return;
  id.initialize({
    client_id: clientId,
    // Dispensar por clique fora colocaria o One Tap em cooldown exponencial (minutos a horas sem prompt).
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: true,
    itp_support: true,
    callback: (response) => pending?.(response),
  });
  initializedFor = clientId;
}

/**
 * Abre o prompt do Google (One Tap / FedCM) e resolve com o ID token escolhido pelo usuário.
 * Rejeita com `GoogleIdentityError` quando o prompt não pôde ser exibido, foi dispensado ou não
 * respondeu dentro de `timeoutMs` — sem o limite o botão ficaria "carregando" para sempre quando o
 * navegador suprime o prompt (sem sessão Google, cooldown, cookies de terceiros bloqueados).
 */
export async function requestGoogleCredential(
  clientId: string,
  timeoutMs = GOOGLE_PROMPT_TIMEOUT_MS,
): Promise<string> {
  const id = await loadGoogleIdentity();
  ensureInitialized(id, clientId);
  return new Promise<string>((resolve, reject) => {
    const state: { settled: boolean; timer?: number } = { settled: false };
    const finish = (fn: () => void) => {
      if (state.settled) return;
      state.settled = true;
      window.clearTimeout(state.timer);
      pending = null;
      fn();
    };
    state.timer = window.setTimeout(() => {
      finish(() => {
        id.cancel();
        reject(new GoogleIdentityError("PROMPT_UNAVAILABLE"));
      });
    }, timeoutMs);
    pending = (response) =>
      finish(() =>
        response.credential
          ? resolve(response.credential)
          : reject(new GoogleIdentityError("NO_CREDENTIAL")),
      );
    id.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        finish(() => reject(new GoogleIdentityError("PROMPT_UNAVAILABLE")));
        return;
      }
      if (
        notification.isDismissedMoment?.() &&
        notification.getDismissedReason?.() !== "credential_returned"
      ) {
        finish(() => reject(new GoogleIdentityError("PROMPT_UNAVAILABLE")));
      }
    });
  });
}
