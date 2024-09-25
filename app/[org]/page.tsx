'use client'
import Navbar from '../../components/navbar'
import Issues from '../../components/issues'


export default async function Page({ params }: { params: { org: string } }) {

    let data = await fetch(`https://api.github.com/orgs/${params.org}`)
    let organisation = await data.json()

    return <div>
        <Navbar orgName={organisation.name} avatar={organisation.avatar_url} href={organisation.html_url} />

        <div className='container mx-auto'>
            <Issues issue_list={[
                {id: 1, issue_title: 'Test Issue', html_url: 'https://github.com/asyncapi'},
                {id: 2, issue_title: 'Test Issue', html_url: 'https://github.com/asyncapi'},
                {id: 3, issue_title: 'Test Issue', html_url: 'https://github.com/asyncapi'}
            ]} />
        </div>
    </div>
}
