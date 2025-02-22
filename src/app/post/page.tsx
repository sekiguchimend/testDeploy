"use client"
import { useState } from "react"
import styles from "./Post.module.css"

export default function Post() {
  const [prefecture, setPrefecture] = useState("")
  const [city, setCity] = useState("")
  const [time, setTime] = useState("")
  const [howMany, setHowMany] = useState("")
  const [content, setContent] = useState("")
  const [money, setMoney] = useState("")

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch("/api/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prefecture,
        city,
        time,
        howMany,
        content,
        money,
      }),
    })
  }

  return (
    <>
    
    <div className={styles.container}>
        
      <div className={styles.formCard}>
        
        <form onSubmit={submitPost}>
          <div className={styles.formField}>
            <label htmlFor="prefecture">県</label>
            <select
              id="prefecture"
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              <option value="東京都">東京都</option>
              <option value="大阪府">大阪府</option>
            </select>
          </div>

          <div className={styles.formField}>
            <label htmlFor="city">市</label>
            <select
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {prefecture === "東京都" && (
                <>
                  <option value="新宿区">新宿区</option>
                  <option value="渋谷区">渋谷区</option>
                </>
              )}
              {prefecture === "大阪府" && (
                <>
                  <option value="大阪市">大阪市</option>
                  <option value="堺市">堺市</option>
                </>
              )}
            </select>
          </div>

          <div className={styles.formField}>
            <label htmlFor="time">時間</label>
            <select
              id="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              <option value="朝">朝</option>
              <option value="昼">昼</option>
              <option value="夕方">夕方</option>
              <option value="夜">夜</option>
            </select>
          </div>

          <div className={styles.formField}>
            <label htmlFor="howMany">何人乗り</label>
            <select
              id="howMany"
              value={howMany}
              onChange={(e) => setHowMany(e.target.value)}
              required
            >
              <option value="1">1人</option>
              <option value="2">2人</option>
              <option value="3">3人</option>
              <option value="4">4人</option>
            </select>
          </div>

          <div className={styles.formField}>
            <label htmlFor="content">募集内容</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          <div className={styles.formField}>
            <label htmlFor="money">金額</label>
            <select
              id="money"
              value={money}
              onChange={(e) => setMoney(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              <option value="1000">1000円</option>
              <option value="2000">2000円</option>
              <option value="3000">3000円</option>
              <option value="4000">4000円</option>
              <option value="5000">5000円</option>
            </select>
          </div>

          <button type="submit">投稿</button>
        </form>
      </div>
    </div>
    </>
  )
}