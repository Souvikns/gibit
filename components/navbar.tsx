
export default function Navbar({ orgName, avatar, href }) {
    return <div className="navbar bg-zinc-800 text-base-300">
        <div className="flex-none mx-4">
            <div className="w-10 rounded-full">
                <img src={avatar} alt="avatar" />
            </div>
        </div>
        <div className="flex-none">
            <a href={href} target="_blank" className="btn btn-ghost text-xl">{orgName}</a>
        </div>

    </div>
}
