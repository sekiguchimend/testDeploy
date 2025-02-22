
const getPosts = async(id:string) => {
    const res = await fetch("http://localhost:3000/api/database",{ cache: "no-store" })
    const datas = await res.json()
    const data = datas.find((post)=>
      post.id == id
    )|| null;
    return data
}

export default async function Details ({params}:{params:{id:string}}){
   const post = await getPosts(params.id)
   
    
    return(
        <div className="container">
            <p></p>
            <p>{post.city}</p>
            <p>{post.howMany}人</p>
            <p>{post.money}円</p>
            <p>{post.contact}</p>
       </div>
    )
}