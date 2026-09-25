import type {
  AddressDto,
  AddressInput,
  AuthResponseDto,
  ForgotPasswordRequest,
  GoogleAuthRequest,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UserProfileDto,
} from "@marketplace/contracts";
import { HttpResponse, http } from "msw";

import { isValidCpf } from "@/lib/validation/documents";

import { db, persistDb } from "../db";
import { DEMO_CREDENTIALS } from "../fixtures/account";
import { API, addDays, nowIso, notFound, simulateLatency, unauthorized, validation } from "./utils";

function issueSession(user: UserProfileDto): AuthResponseDto {
  const accessToken = `mock.${crypto.randomUUID()}`;
  db.tokens.push(accessToken);
  persistDb();
  return {
    accessToken,
    refreshToken: `refresh.${crypto.randomUUID()}`,
    expiresAt: addDays(nowIso(), 7),
    user,
  };
}

function isAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  return db.tokens.includes(auth.replace(/^Bearer\s+/i, ""));
}

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as LoginRequest;
    const email = body.email?.trim().toLowerCase();
    if (email !== DEMO_CREDENTIALS.email && email !== db.user.email.toLowerCase()) {
      return validation({ email: ["Conta não encontrada. Use demo@mktpy.com / 123456."] });
    }
    if (body.password !== DEMO_CREDENTIALS.password) {
      return validation({ password: ["Senha incorreta. Dica: 123456."] });
    }
    return HttpResponse.json(issueSession(db.user));
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as RegisterRequest;
    const errors: Record<string, string[]> = {};
    if (!body.fullName || body.fullName.trim().length < 3)
      errors.fullName = ["Informe seu nome completo."];
    if (!body.email?.includes("@")) errors.email = ["E-mail inválido."];
    if (!body.password || body.password.length < 8)
      errors.password = ["A senha deve ter pelo menos 8 caracteres."];
    if (body.email?.toLowerCase() === "existe@mktpy.com")
      errors.email = ["Este e-mail já está cadastrado."];
    if (Object.keys(errors).length) return validation(errors);

    db.user = {
      id: crypto.randomUUID(),
      fullName: body.fullName.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.replace(/\D/g, "") || null,
      cpf: null,
      avatarUrl: null,
      roles: ["Comprador"],
      createdAt: nowIso(),
    };
    return HttpResponse.json(issueSession(db.user), { status: 201 });
  }),

  http.post(`${API}/auth/google`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as GoogleAuthRequest;
    if (!body.idToken) return validation({ idToken: ["Token inválido."] });
    return HttpResponse.json(issueSession(db.user));
  }),

  http.post(`${API}/auth/forgot-password`, async ({ request }) => {
    await simulateLatency();
    const body = (await request.json()) as ForgotPasswordRequest;
    if (!body.email?.includes("@")) return validation({ email: ["E-mail inválido."] });
    // Resposta sempre 202 para não revelar se o e-mail existe.
    return new HttpResponse(null, { status: 202 });
  }),

  http.post(`${API}/auth/logout`, async ({ request }) => {
    await simulateLatency();
    const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (auth) {
      db.tokens = db.tokens.filter((t) => t !== auth);
      persistDb();
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/auth/refresh`, async () => {
    await simulateLatency();
    return HttpResponse.json(issueSession(db.user));
  }),

  // ----- Perfil -----
  http.get(`${API}/me`, async ({ request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    return HttpResponse.json(db.user);
  }),

  http.put(`${API}/me`, async ({ request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const body = (await request.json()) as UpdateProfileRequest;
    const errors: Record<string, string[]> = {};
    if (!body.fullName || body.fullName.trim().length < 3)
      errors.fullName = ["Informe seu nome completo."];
    if (body.cpf && !isValidCpf(body.cpf)) errors.cpf = ["CPF inválido."];
    if (Object.keys(errors).length) return validation(errors);
    db.user = {
      ...db.user,
      fullName: body.fullName.trim(),
      phone: body.phone ? body.phone.replace(/\D/g, "") : null,
      cpf: body.cpf ? body.cpf.replace(/\D/g, "") : null,
    };
    persistDb();
    return HttpResponse.json(db.user);
  }),

  // ----- Endereços -----
  http.get(`${API}/me/addresses`, async ({ request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    return HttpResponse.json(db.addresses);
  }),

  http.post(`${API}/me/addresses`, async ({ request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const body = (await request.json()) as AddressInput;
    if (!/^\d{8}$/.test(body.postalCode?.replace(/\D/g, "") ?? ""))
      return validation({ postalCode: ["CEP inválido."] });
    const address: AddressDto = {
      ...body,
      id: crypto.randomUUID(),
      postalCode: body.postalCode.replace(/\D/g, ""),
      country: "BR",
      complement: body.complement || null,
      phone: body.phone ? body.phone.replace(/\D/g, "") : null,
    };
    if (address.isDefault || db.addresses.length === 0) {
      db.addresses = db.addresses.map((a) => ({ ...a, isDefault: false }));
      address.isDefault = true;
    }
    db.addresses.push(address);
    persistDb();
    return HttpResponse.json(address, { status: 201 });
  }),

  http.put(`${API}/me/addresses/:id`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const index = db.addresses.findIndex((a) => a.id === params.id);
    if (index < 0) return notFound("Endereço");
    const body = (await request.json()) as AddressInput;
    const updated: AddressDto = {
      ...db.addresses[index],
      ...body,
      postalCode: body.postalCode.replace(/\D/g, ""),
      complement: body.complement || null,
      phone: body.phone ? body.phone.replace(/\D/g, "") : null,
    };
    if (updated.isDefault) db.addresses = db.addresses.map((a) => ({ ...a, isDefault: false }));
    db.addresses[index] = updated;
    persistDb();
    return HttpResponse.json(updated);
  }),

  http.delete(`${API}/me/addresses/:id`, async ({ params, request }) => {
    await simulateLatency();
    if (!isAuthorized(request)) return unauthorized();
    const exists = db.addresses.some((a) => a.id === params.id);
    if (!exists) return notFound("Endereço");
    db.addresses = db.addresses.filter((a) => a.id !== params.id);
    if (db.addresses.length && !db.addresses.some((a) => a.isDefault))
      db.addresses[0].isDefault = true;
    persistDb();
    return new HttpResponse(null, { status: 204 });
  }),
];
