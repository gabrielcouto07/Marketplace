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

export const storeSchema = z.object({
  name: z.string().trim().min(3, "storeNameMin").max(80, "storeNameMax"),
  ruc: rucSchema,
  city: z.string().trim().min(2, "required"),
  description: z.string().trim().min(20, "descriptionMin").max(1000, "descriptionMax"),
  logoUrl: z.string().nullable().default(null),
  bannerUrl: z.string().nullable().default(null),
  exchangePolicy: z.string().trim().max(1000, "descriptionMax").optional().default(""),
  categoryIds: z.array(z.string()).min(1, "categoryRequired"),
});
export type StoreFormValues = z.input<typeof storeSchema>;
export type StoreFormOutput = z.output<typeof storeSchema>;

export const productSchema = z
  .object({
    name: z.string().trim().min(5, "productNameMin").max(200, "productNameMax"),
    description: z.string().trim().min(20, "descriptionMin").max(4000, "descriptionMax"),
    categoryId: z.string().min(1, "categoryRequired"),
    /** Centavos (inteiro). */
    priceAmount: z.number().int().min(100, "priceMin"),
    compareAtAmount: z.number().int().nullable().default(null),
    stock: z.number().int().min(0, "stockMin"),
    freeShipping: z.boolean().default(false),
    warrantyMonths: z.number().int().min(0).max(120).nullable().default(null),
    handlingDaysMin: z.number().int().min(0).max(30).default(1),
    handlingDaysMax: z.number().int().min(0).max(30).default(3),
    attributes: z
      .array(z.object({ name: z.string().trim(), value: z.string().trim() }))
      .default([]),
    images: z
      .array(
        z.object({
          url: z.string().min(1),
          alt: z.string().nullable().optional(),
          storageKey: z.string().nullable().optional(),
        }),
      )
      .min(1, "imagesMin")
      .max(8, "imagesMax"),
    status: z.enum(["Ativo", "Rascunho"]).default("Ativo"),
  })
  .refine((v) => v.compareAtAmount === null || v.compareAtAmount > v.priceAmount, {
    path: ["compareAtAmount"],
    message: "compareAtGreater",
  })
  .refine((v) => v.handlingDaysMax >= v.handlingDaysMin, {
    path: ["handlingDaysMax"],
    message: "handlingRange",
  });
export type ProductFormValues = z.input<typeof productSchema>;
export type ProductFormOutput = z.output<typeof productSchema>;

export const shipOrderSchema = z.object({
  carrier: z.string().trim().min(2, "required"),
  trackingCode: z
    .string()
    .trim()
    .min(8, "trackingCodeLength")
    .max(40, "trackingCodeLength")
    .transform((v) => v.toUpperCase()),
});
export type ShipOrderFormValues = z.input<typeof shipOrderSchema>;

export const questionSchema = z.object({
  question: z.string().trim().min(10, "questionMin").max(500, "questionMax"),
});
export type QuestionFormValues = z.infer<typeof questionSchema>;
