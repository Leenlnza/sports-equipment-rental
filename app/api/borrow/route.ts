import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback-secret") as any
    const userId = decoded.userId

    const body = await request.json()
    const { equipmentId } = body

    const client = await clientPromise
    const db = client.db("lcc_sports_new")
    const equipment = db.collection("equipment")
    const borrowRecords = db.collection("borrow_records")

    const equipmentItem = await equipment.findOne({ _id: new ObjectId(equipmentId) })
    if (!equipmentItem) {
      return NextResponse.json({ error: "ไม่พบอุปกรณ์ที่ต้องการยืม" }, { status: 404 })
    }

    if (equipmentItem.available <= 0) {
      return NextResponse.json({ error: "อุปกรณ์ไม่ว่าง" }, { status: 400 })
    }

    const borrowRecord = {
      userId: new ObjectId(userId),
      equipmentId: new ObjectId(equipmentId),
      equipmentName: equipmentItem.name,
      borrowDate: new Date(),
      returnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: "borrowed",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await borrowRecords.insertOne(borrowRecord)

    await equipment.updateOne(
      { _id: new ObjectId(equipmentId) },
      {
        $inc: { available: -1 },
        $set: { updatedAt: new Date() },
      },
    )

    return NextResponse.json({
      message: "ยืมอุปกรณ์สำเร็จ",
      borrowRecord,
    })
  } catch (error) {
    console.error("Borrow error:", error)
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการยืมอุปกรณ์" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback-secret") as any
    const userId = decoded.userId

    const client = await clientPromise
    const db = client.db("lcc_sports_new")
    const borrowRecords = db.collection("borrow_records")

    const records = await borrowRecords
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray()

    return NextResponse.json(records)
  } catch (error) {
    console.error("Borrow records fetch error:", error)
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูลการยืม" }, { status: 500 })
  }
}
