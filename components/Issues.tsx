import Issue from "./Issue"

export default function Issues({ issue_list }: { issue_list: Array<any> }) {
    const firstIssue = issue_list[0]
    const lastIssue = issue_list[issue_list.length - 1]
    if (issue_list.length >= 3) {
        issue_list.shift()
        issue_list.pop()
    }
    return <div>
        <Issue html_url={firstIssue.html_url} issue_title={firstIssue.issue_title} first />
        {issue_list.map(e => <Issue issue_title={e.issue_title} html_url={e.html_url} key={e.id} />)}
        <Issue issue_title={lastIssue.issue_title} html_url={lastIssue.html_url} last />
    </div>
}
