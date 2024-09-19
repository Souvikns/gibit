
export default function Issue({
    issue_title,
    html_url
}) {
    return <div className="border-2 p-2 rounded-lg">
        <p className="font-semibold">{issue_title}</p>
        <p className="text-sm">#2345 opened 2 days ago, by @Souvikns</p>
    </div>
}