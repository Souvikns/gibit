'use client'
import Navbar from '../../components/navbar'
import Issues from '../../components/Issues'
import { fetchOrgData } from '../../lib/github'


export default async function Page({ params }: { params: { org: string } }) {

    const organisation = await fetchOrgData(params.org)

    return <div>
        <Navbar orgName={organisation.name} avatar={organisation.avatar_url} href={organisation.html_url} />

        <div className='container mx-auto'>
            <Issues issue_list={[
                { id: 1, issue_title: 'Test Issue', html_url: 'https://github.com/asyncapi' },
                { id: 2, issue_title: 'Test Issue', html_url: 'https://github.com/asyncapi' },
                { id: 3, issue_title: 'Test Issue', html_url: 'https://github.com/asyncapi' }
            ]} />
        </div>
    </div>
}
