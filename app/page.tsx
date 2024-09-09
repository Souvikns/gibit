import Searchbar from "../components/searchbar"
export default function Page() {
    return <div className="container mx-auto">
        <div className="flex items-center justify-center h-screen">
            <div className="flex flex-row w-2/4 justify-center space-x-3">
                <Searchbar />
                <button className="btn btn-primary btn-outline">Search</button>
            </div>
        </div>
    </div>
}