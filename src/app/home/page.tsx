"use client"
import Link from "next/link";
import styles from "./home.module.css"
import { useState,useEffect } from "react"
export default function Home (){
    const [search,setSearch] = useState("");
    const [posts,setposts] = useState([])
    useEffect(()=>{
     const getPosts = async()=>{
        const res = await fetch("/api/database")
        const data = await res.json()
        setposts(data)
     }
     getPosts();
    },[])

    return(
        <div className={styles.home_container}>
          
            <main className={styles.home_main}>

                <div className={styles.home_posts}>
                    {posts.map((post)=>(
                   

                        <div className={styles.home_post}key={post.id}>
                            <Link href={`./${post.id}`}>
                          <p className={styles.home_prefecture}>{post.prefecture}</p>
                          <p className={styles.home_city}>{post.city}</p>
                          <p className={styles.home_time}>{post.time}</p>
                          <p className={styles.home_howmany}>{post.howMany}</p>
                          <p className={styles.home_content}>{post.content}</p>
                          <p className={styles.home_author}>{post.money}</p>
                          </Link>
                        </div>
                    
                    ))}
                </div>
                <aside className={styles.home_article}>



                </aside>
            </main>
        </div>
    )
}