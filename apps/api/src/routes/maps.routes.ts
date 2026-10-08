import { Router, Request, Response } from 'express';
import { getMapProvider, RouteQuerySchema, AutocompleteQuerySchema, ReverseGeocodeQuerySchema } from '@cab-app/shared';
import { validateBody, validateQuery } from '../middleware/validate.js';

const router = Router();
const mapProvider = getMapProvider();

router.get(
  '/maps/autocomplete',
  validateQuery(AutocompleteQuerySchema),
  async (req: Request, res: Response) => {
    const { query, city } = req.query as { query: string; city?: string };
    const suggestions = await mapProvider.autocomplete(query, city || 'Bangalore');
    res.json({ suggestions });
  }
);

router.get(
  '/maps/reverse',
  validateQuery(ReverseGeocodeQuerySchema),
  async (req: Request, res: Response) => {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const address = await mapProvider.reverseGeocode(lat, lng);
    res.json({ address });
  }
);

router.post(
  '/maps/route',
  validateBody(RouteQuerySchema),
  async (req: Request, res: Response) => {
    const { pickup, dropoff, stops = [] } = req.body;
    const waypoints = [pickup, ...stops, dropoff];
    const route = await mapProvider.getRoute(waypoints);
    res.json({ route });
  }
);

export default router;
