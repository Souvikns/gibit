
export default function Searchbar({ data, update }: { data: string, update: Function }) {

    return <input
        type="text"
        value={data}
        onChange={e => update(e.currentTarget.value)}
        placeholder="Search GitHub Organization"
        className="input input-bordered rounded-sm w-full max-w-xs"
    />
}
