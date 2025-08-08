// lib/validation.ts
import { z } from "zod";

export const productCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  imageUrl: z.string().url().optional(),
  stock: z.number().int().min(0).default(0),
  categoryId: z.string().min(1).optional().nullable(),
});
export const productUpdateSchema = productCreateSchema.partial();

export const cartAddSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
});
export const cartUpdateSchema = z.object({
  quantity: z.number().int().min(1),
});

export const orderCreateSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().min(1).default(1),
    })
  ).min(1),
});

export const shipmentCreateSchema = z.object({
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
});
export const shipmentUpdateSchema = z.object({
  status: z.string().min(1).optional(),
  shippedAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
});

export const receiptCreateSchema = z.object({
  pdfUrl: z.string().url(),
});
