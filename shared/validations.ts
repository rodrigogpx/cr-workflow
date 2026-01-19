import { z } from "zod";

// ============================================
// Funções de Validação de CPF
// ============================================

/**
 * Valida o dígito verificador do CPF
 */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  
  if (digits.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

// ============================================
// Funções de Formatação
// ============================================

export const formatCPF = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

export const formatCEP = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

// ============================================
// Schemas Zod Reutilizáveis
// ============================================

// CPF com validação de dígito verificador
export const cpfSchema = z
  .string()
  .min(11, "CPF deve ter 11 dígitos")
  .transform((val: string) => val.replace(/\D/g, ""))
  .refine((val: string) => val.length === 11, "CPF deve ter 11 dígitos")
  .refine((val: string) => isValidCPF(val), "CPF inválido");

// CPF opcional (para updates)
export const cpfOptionalSchema = z
  .string()
  .optional()
  .transform((val: string | undefined) => val?.replace(/\D/g, "") || undefined)
  .refine((val: string | undefined) => !val || val.length === 11, "CPF deve ter 11 dígitos")
  .refine((val: string | undefined) => !val || isValidCPF(val), "CPF inválido");

// Email
export const emailSchema = z
  .string()
  .email("Email inválido")
  .min(1, "Email é obrigatório");

export const emailOptionalSchema = z
  .string()
  .email("Email inválido")
  .optional()
  .or(z.literal(""));

// Telefone brasileiro (10 ou 11 dígitos)
export const phoneSchema = z
  .string()
  .min(10, "Telefone deve ter pelo menos 10 dígitos")
  .transform((val: string) => val.replace(/\D/g, ""))
  .refine((val: string) => val.length >= 10 && val.length <= 11, "Telefone inválido");

export const phoneOptionalSchema = z
  .string()
  .optional()
  .transform((val: string | undefined) => val?.replace(/\D/g, "") || undefined)
  .refine((val: string | undefined) => !val || (val.length >= 10 && val.length <= 11), "Telefone inválido");

// CEP brasileiro (8 dígitos)
export const cepSchema = z
  .string()
  .transform((val: string) => val.replace(/\D/g, ""))
  .refine((val: string) => val.length === 8, "CEP deve ter 8 dígitos");

export const cepOptionalSchema = z
  .string()
  .optional()
  .transform((val: string | undefined) => val?.replace(/\D/g, "") || undefined)
  .refine((val: string | undefined) => !val || val.length === 8, "CEP deve ter 8 dígitos");

// Data no formato YYYY-MM-DD
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD")
  .refine((val: string) => {
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Data inválida");

export const dateOptionalSchema = z
  .string()
  .optional()
  .refine((val: string | undefined) => {
    if (!val || val === "") return true;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(val)) return false;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, "Data inválida");

// Nome (mínimo 2 caracteres, sem números)
export const nameSchema = z
  .string()
  .min(2, "Nome deve ter pelo menos 2 caracteres")
  .regex(/^[^\d]+$/, "Nome não pode conter números");

export const nameOptionalSchema = z
  .string()
  .optional()
  .refine((val: string | undefined) => !val || val.length >= 2, "Nome deve ter pelo menos 2 caracteres");

// Senha (mínimo 6 caracteres)
export const passwordSchema = z
  .string()
  .min(6, "Senha deve ter pelo menos 6 caracteres");

// UF brasileira
export const ufSchema = z
  .string()
  .length(2, "UF deve ter 2 caracteres")
  .toUpperCase();

export const ufOptionalSchema = z
  .string()
  .optional()
  .refine((val: string | undefined) => !val || val.length === 2, "UF deve ter 2 caracteres")
  .transform((val: string | undefined) => val?.toUpperCase());

// ============================================
// Schemas de Formulários Completos
// ============================================

// Schema de Login
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha é obrigatória"),
});

// Schema de Registro
export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

// Schema de Criação de Cliente
export const createClientSchema = z.object({
  name: nameSchema,
  cpf: cpfSchema,
  phone: phoneSchema,
  email: emailSchema,
  operatorId: z.number().optional(),
});

// Schema de Atualização de Cliente
export const updateClientSchema = z.object({
  id: z.number(),
  name: nameOptionalSchema,
  cpf: cpfOptionalSchema,
  phone: phoneOptionalSchema,
  email: emailOptionalSchema,
  operatorId: z.number().optional(),
  // Dados pessoais adicionais
  identityNumber: z.string().optional(),
  identityIssueDate: dateOptionalSchema,
  identityIssuer: z.string().optional(),
  identityUf: ufOptionalSchema,
  birthDate: dateOptionalSchema,
  birthCountry: z.string().optional(),
  birthUf: ufOptionalSchema,
  birthPlace: z.string().optional(),
  gender: z.string().optional(),
  profession: z.string().optional(),
  otherProfession: z.string().optional(),
  registrationNumber: z.string().optional(),
  currentActivities: z.string().optional(),
  phone2: phoneOptionalSchema,
  motherName: z.string().optional(),
  fatherName: z.string().optional(),
  maritalStatus: z.string().optional(),
  requestType: z.string().optional(),
  cacNumber: z.string().optional(),
  cacCategory: z.string().optional(),
  previousCrNumber: z.string().optional(),
  psychReportValidity: dateOptionalSchema,
  techReportValidity: dateOptionalSchema,
  residenceUf: ufOptionalSchema,
  // Endereço
  cep: cepOptionalSchema,
  address: z.string().optional(),
  addressNumber: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  complement: z.string().optional(),
});

// Schema de Criação de Usuário
export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["operator", "admin", "despachante"], {
    errorMap: () => ({ message: "Selecione um perfil válido" }),
  }),
});

// Schema de Atualização de Usuário
export const updateUserSchema = z.object({
  userId: z.number(),
  name: nameOptionalSchema,
  email: emailOptionalSchema,
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").optional().or(z.literal("")),
  role: z.enum(["operator", "admin", "despachante"]).optional(),
});

// Tipos inferidos
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
