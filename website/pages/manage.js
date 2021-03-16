import Head from 'next/head'
import useSWR from 'swr'
import Navbar from '../components/navbar.js'
import Footer from '../components/footer.js'
import Button from '../components/button.js'
import { getEdgeState } from '../lib/state.js'
import configs from '../lib/config.js'

export default function ManageKeys () {
  const { data } = useSWR('edge_state', getEdgeState)
  const { user, loginUrl = '#', tokens = [] } = data ?? {}
  async function deleteToken(e) {
    e.preventDefault()
    const name = e.target.name.value
    const rsp = await fetch(configs.api + '/api/internal/tokens', {
      method: 'delete',
      body: JSON.stringify({ name }),
    })
    const data = await rsp.json()
    if (data.ok) {
      location = '/manage'
    } else {
      console.error(data.error)
    }
  }
  return (
    <div className='sans-serif'>
      <Head>
        <title>Manage API keys</title>
        <link rel='icon' href='/favicon.ico' />
      </Head>
      <Navbar user={user} loginUrl={loginUrl} />
      <main className='mw9 center bg-nspeach pv3 ph5 min-vh-100'>
        <div>
          <div className='flex mb3 items-center'>
            <h1 className='chicagoflf mv4 flex-auto'>Manage API Keys</h1>
            <Button href='/new-key' className='flex-none'>+ New Key</Button>
          </div>
          {tokens.length ? (
            <table className='bg-white ba b--black w-100 collapse mb4'>
              <tr className='bb b--black'>
                <th className='pa2 tl bg-nsgray br b--black w-20'>Name</th>
                <th className='pa2 tl bg-nsgray br b--black w-50'>Key</th>
                <th className='pa2 tc bg-nsgray' />
              </tr>
              {tokens.map(t => (
                <tr className='bb b--black'>
                  <td className='pa2 br b--black'>
                    {t.name}
                  </td>
                  <td className='pa2 br b--black mw7'>
                    <input className='w-90' value={t.token}/>
                    {/* <code style={{ wordWrap: 'break-word' }}>{t.token}</code> */}
                  </td>
                  <td className='pa2'>
                    <form onSubmit={deleteToken}>
                      <input type='hidden' name='name' id='name' value={t.name} />
                      <Button className='bg-nsorange white' type='submit'>Delete</Button>
                    </form>
                  </td>
                </tr>
              ))}
            </table>
          ) : <p className='tc mv5'><span className='f1 dib mb3'>😢</span><br/>No API keys</p>}
        </div>
      </main>
      <Footer />
    </div>
  )
}
