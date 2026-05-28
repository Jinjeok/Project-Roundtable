import { NextResponse } from "next/server";
import { openGameSession, sendGameInput } from "../../../lib/gameService.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();

    if (body.action === "start") {
      return NextResponse.json(await openGameSession(body.sessionId));
    }
    if (body.action === "message") {
      return NextResponse.json(await sendGameInput(body.sessionId, body.input));
    }

    return NextResponse.json({ error: "지원하지 않는 요청입니다." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
