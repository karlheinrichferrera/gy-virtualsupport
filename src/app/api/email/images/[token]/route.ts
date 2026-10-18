import { emailImage } from "@/lib/email-images";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const image = await emailImage(token);
  if (!image) return new Response(null, { status: 404 });
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await image.chunks.next();
        if (result.done) controller.close(); else controller.enqueue(result.value);
      } catch (error) { controller.error(error); }
    },
    async cancel() { await image.chunks.return(undefined); },
  });
  return new Response(body, { headers: { "Content-Type": image.contentType, "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}
