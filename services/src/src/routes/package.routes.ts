import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate, valid } from '../middleware/validate.js';
import { packageService, type PackageInput } from '../services/package.service.js';

export const packageRouter = Router();

const PackageBody = z.object({
  origin: z.string().length(3),
  destinationIata: z.string().length(3),
  destinationName: z.string().min(1).max(80),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).max(9),
  children: z.coerce.number().int().min(0).max(9).optional(),
  budget: z.coerce.number().min(0).optional(),
});

/** POST /api/package — assemble a complete trip (flight + hotel + activities)
 *  with a single total and budget check. One object → one payment. */
packageRouter.post(
  '/',
  validate(PackageBody, 'body'),
  asyncHandler(async (req, res) => {
    const b = valid<PackageInput>(req);
    const pkg = await packageService.assemble(b);
    res.json(pkg);
  }),
);
