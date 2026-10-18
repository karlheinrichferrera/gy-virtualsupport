import { notificationImage } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^-?[1-9]\d*$/.test(id)) return new Response(null, { status: 404 });
  const image = await notificationImage(Number(id));
  if (!image) return new Response(null, { status: 404 });
  const body = "bytes" in image ? new Uint8Array(image.bytes) : new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await image.chunks.next();
        if (result.done) controller.close();
        else controller.enqueue(result.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() { await image.chunks.return(undefined); },
  });
  return new Response(body, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
