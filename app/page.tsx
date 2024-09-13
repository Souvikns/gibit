'use client'
import { useState } from "react"
import Searchbar from "../components/searchbar"
import { useRouter } from 'next/navigation'
export default function Page() {
    const router = useRouter()
    const [search, setSearch] = useState('')
    return <div className="container mx-auto">
        <div className="flex items-center justify-center h-screen">
            <div className="flex flex-row w-2/4 justify-center space-x-3">
                <Searchbar data={search} update={setSearch} />
                <button className="btn btn-primary btn-outline" onClick={() => {
                    router.push(`/${search}`)
                }}>Search</button>
            </div>
        </div>
    </div>
}
