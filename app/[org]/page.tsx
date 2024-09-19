'use client'
import Navbar from '../../components/navbar'
import Issue from '../../components/Issue'


export default async function Page({ params }: { params: { org: string } }) {

    let data = await fetch(`https://api.github.com/orgs/${params.org}`)
    let organisation = await data.json()

    return <div>
        <Navbar orgName={organisation.name} avatar={organisation.avatar_url} href={organisation.html_url} />

        <div className='container mx-auto'>

        <Issue issue_title={"Test Issue Title"} html_url={"https://github.com/asyncapi"} />
        </div>
    </div>
}
