import { GET as getV1Categories } from '../v1/categories/route';

export async function GET(request: Request) {
  return getV1Categories(request);
}
