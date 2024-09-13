
export default function Page({ params }: { params: { org: string } }) {
    return <div>
        {params.org}
    </div>
}
