
export default function Issue({
    issue_title,
    html_url,
    first,
    last
}: { issue_title: string, html_url: string, first?: boolean, last?: boolean }) {
    let border = ''
    if (first) {
        border = 'rounded-t-lg'
    }
    if (last) {
        border = 'rounded-b-lg'
    }
    return <div className={`border-2 p-2 ${border}`}>
        <p className="font-semibold">{issue_title}</p>
        <p className="text-sm">#2345 opened 2 days ago, by @Souvikns</p>
    </div>
}
