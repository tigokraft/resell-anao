// lib/http.ts
export function ok(data: any, init: ResponseInit = {}) {
  return Response.json({ success: true, data }, { status: 200, ...init });
}
export function created(data: any, location?: string) {
  const headers = location ? { Location: location } : undefined as any;
  return Response.json({ success: true, data }, { status: 201, headers });
}
export function badRequest(message: string, issues?: any) {
  return Response.json({ success: false, error: { message, issues } }, { status: 400 });
}
export function unauthorized(message = "Unauthorized") {
  return Response.json({ success: false, error: { message } }, { status: 401 });
}
export function forbidden(message = "Forbidden") {
  return Response.json({ success: false, error: { message } }, { status: 403 });
}
export function notFound(message = "Not found") {
  return Response.json({ success: false, error: { message } }, { status: 404 });
}
export function serverError(message = "Internal Server Error") {
  return Response.json({ success: false, error: { message } }, { status: 500 });
}
