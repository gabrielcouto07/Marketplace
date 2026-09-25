import { z } from "zod";

import { isValidCep, isValidCpf, isValidRuc, onlyDigits } from "./documents";

/**
 * Schemas Zod reutilizados pelos formulários (React Hook Form + zodResolver).
 * As mensagens são chaves de tradução (namespace "validation") resolvidas na UI.
 */

export const emailSchema = z.string().trim().min(1, "required").email("invalidEmail");

export const passwordSchema = z.string().min(8, "passwordMin").max(72, "passwordMax");

export const cpfSchema = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v.length === 11, "cpfLength")
  .refine(isValidCpf, "invalidCpf");

export const optionalCpfSchema = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v.length === 0 || (v.length === 11 && isValidCpf(v)), "invalidCpf")
  .transform((v) => (v.length === 0 ? null : v));

export const rucSchema = z.string().trim().refine(isValidRuc, "invalidRuc");

export const cepSchema = z.string().transform(onlyDigits).refine(isValidCep, "invalidCep");

export const phoneBrSchema = z
  .string()
  .transform(onlyDigits)
  .refine((v) => v.length === 10 || v.length === 11, "invalidPhone");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "required"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, "nameMin"),
    email: emailSchema,
    phone: phoneBrSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v, "acceptTerms"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  });
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(3, "nameMin"),
  phone: phoneBrSchema,
  cpf: cpfSchema,
});
export type ProfileFormValues = z.infer<typeof profileSchema>;

export const addressSchema = z.object({
  label: z.string().trim().min(1, "required"),
  recipientName: z.string().trim().min(3, "nameMin"),
  postalCode: cepSchema,
  street: z.string().trim().min(1, "required"),
  number: z.string().trim().min(1, "required"),
  complement: z.string().trim().optional().default(""),
  neighborhood: z.string().trim().min(1, "required"),
  city: z.string().trim().min(1, "required"),
  state: z.string().trim().length(2, "invalidState"),
  phone: phoneBrSchema.optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});
export type AddressFormValues = z.input<typeof addressSchema>;
export type AddressFormOutput = z.output<typeof addressSchema>;

export const cepLookupSchema = z.object({ postalCode: cepSchema });

export const cardSchema = z.object({
  holderName: z.string().trim().min(3, "nameMin"),
  number: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v.length >= 13 && v.length <= 19, "invalidCard"),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "invalidExpiry"),
  cvv: z.string().regex(/^\d{3,4}$/, "invalidCvv"),
  installments: z.number().int().min(1).max(12),
  payerDocument: cpfSchema,
});
export type CardFormValues = z.input<typeof cardSchema>;

export const questionSchema = z.object({
  question: z.string().trim().min(10, "questionMin").max(500, "questionMax"),
});
export type QuestionFormValues = z.infer<typeof questionSchema>;
