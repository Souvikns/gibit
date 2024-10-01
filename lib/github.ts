export interface OrgDataInterface {
    name: string
    avatar_url: string
    html_url: string
}


export async function fetchOrgData(org: string): Promise<OrgDataInterface> {
    let data = await fetch(`https://api.github.com/orgs/${org}`)
    let organisation = await data.json()
    return {
        name: organisation.name,
        avatar_url: organisation.avatar_url,
        html_url: organisation.html_url
    }
}