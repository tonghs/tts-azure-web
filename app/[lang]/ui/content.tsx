'use client'
import { Key, useCallback, useEffect, useRef, useState } from 'react'
import { faCircleDown, faCirclePause, faCirclePlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@nextui-org/button'
import { base64AudioToBlobUrl, filterAndDeduplicateByGender, saveAs } from '../../lib/tools'
import { GenderItem, LangsItem, ListItem, VoiceNameItem } from '../../lib/types'
import InputText from './components/input-text'
import LanguageSelect from './components/language-select'
import { type getDictionary } from '@/get-dictionary'

export default function Content({ t }: { t: Awaited<ReturnType<typeof getDictionary>> }) {
  const [input, setInput] = useState('你好，这是一段测试文字')
  const [isLoading, setLoading] = useState<boolean>(false)
  const [langs, setLangs] = useState<LangsItem[]>([])
  const [list, setList] = useState<ListItem[]>([])
  const [genders, setGenders] = useState<GenderItem[]>([])
  const [selectedGender, setSelectedGender] = useState('Female')
  const [voiceName, setVoiceName] = useState('')
  const [voiceNames, setVoiceNames] = useState<VoiceNameItem[]>([])
  const [selectedLang, setSelectedLang] = useState('zh-CN')
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cacheConfigRef = useRef<string | null>(null)

  const handleSelectGender = (e: React.MouseEvent<HTMLButtonElement>, gender: string) => {
    setSelectedGender(gender)
  }

  const handleSelectLang = useCallback(
    (value: Key | null) => {
      if (!value) return
      setSelectedLang(value.toString())
      const data = list?.filter(item => item.Locale === value)
      setGenders(filterAndDeduplicateByGender(data))
    },
    [list],
  )

  useEffect(() => {
    let ignore = false
    async function getList() {
      try {
        const res = await fetch('/api/list')
        // In the development environment, fetch data can't stop, just stop setting the data a second time
        if (ignore) return
        const data: ListItem[] = await res.json()
        setList(data)
        const map = new Map()
        data.forEach(item => {
          map.set(item.Locale, item.LocaleName)
        })
        const result = [...map].map(([value, label]) => ({ label, value }))
        setLangs(result)
      } catch (error) {
        console.error('Failed to fetch list:', error)
      }
    }
    getList()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    // Avoid list data initialization effect
    if (!list.length) return
    const dataForSelectedLang = list.filter(item => item.Locale === selectedLang)
    const _genders = filterAndDeduplicateByGender(dataForSelectedLang)
    setGenders(_genders)
    const dataForVoiceName = dataForSelectedLang.filter(item => item.Gender === selectedGender)
    const _voiceNames = dataForVoiceName.map(item => ({ label: item.LocalName, value: item.ShortName }))
    setVoiceNames(_voiceNames)
    _voiceNames.length && setVoiceName(_voiceNames[0].value)
  }, [list, selectedLang, selectedGender])

  const fetchAudio = async () => {
    const res = await fetch('/api/audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input, voiceName, selectedLang }),
    })
    return res.json()
  }

  const play = async () => {
    if (!input.length || isLoading) return
    const cacheString = input + voiceName + selectedLang
    if (cacheConfigRef.current === cacheString) {
      setIsPlaying(true)
      audioRef.current?.play()
      return
    }
    audioRef.current = null
    setLoading(true)

    try {
      const { base64Audio } = await fetchAudio()
      const url = base64AudioToBlobUrl(base64Audio)
      if (!audioRef.current) {
        audioRef.current = new Audio(url)
        audioRef.current.onended = () => {
          setIsPlaying(false)
        }
      }
      setIsPlaying(true)
      audioRef.current?.play()
      cacheConfigRef.current = cacheString
    } catch (err) {
      console.error('Error fetching audio:', err)
    } finally {
      setLoading(false)
    }
  }

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsPlaying(false)
  }

  const handleDownload = async () => {
    if (!audioRef.current || !audioRef.current.src) return
    const response = await fetch(audioRef.current.src)
    const blob = await response.blob()
    saveAs(blob, new Date().toISOString().replace('T', ' ').replace(':', '_').split('.')[0] + '.mp3')
  }

  return (
    <div className="grow overflow-y-auto flex md:justify-center gap-10 py-5 px-6 sm:px-10 md:px-10 lg:px-20 xl:px-40 2xl:px-50 flex-col md:flex-row">
      <div className="md:flex-1">
        <InputText t={t} input={input} setInput={setInput} />
        <p className="text-right pt-2">{input.length}/7000</p>
        <div className="flex justify-between items-center pt-6">
          <FontAwesomeIcon
            icon={faCircleDown}
            className="w-8 h-8 text-blue-600 cursor-pointer"
            onClick={handleDownload}
          />
          <FontAwesomeIcon
            icon={isPlaying ? faCirclePause : faCirclePlay}
            className={`w-8 h-8 text-blue-${isLoading ? '600/50' : '600'} cursor-pointer`}
            onClick={isPlaying ? pause : play}
          />
        </div>
      </div>

      <div className="md:flex-1 flex flex-col">
        <LanguageSelect t={t} langs={langs} selectedLang={selectedLang} handleSelectLang={handleSelectLang} />
        <div className="pt-4 flex gap-2">
          {genders.map(
            item =>
              item.show && (
                <Button
                  color={selectedGender === item.value ? 'primary' : 'default'}
                  onClick={e => handleSelectGender(e, item.value)}
                  key={item.value}
                >
                  {t[item.label]}
                </Button>
              ),
          )}
        </div>
        <div className="pt-10">
          {langs.length ? <p>{t.voice}</p> : null}
          <div className="flex flex-wrap gap-2">
            {voiceNames.map(item => {
              return (
                <Button
                  key={item.value}
                  color={item.value === voiceName ? 'primary' : 'default'}
                  className="mt-4"
                  onClick={() => setVoiceName(item.value)}
                >
                  {item.label.split(' ').join(' - ')}
                </Button>
              )
            })}
          </div>
        </div>

        {/* <div className="pt-10">
          <p>情感</p>
          <Button color="default">助手</Button>
        </div>

        <div className="pt-10">
          <p>扮演</p>
          <Button color="default">扮演</Button>
        </div> */}
      </div>
    </div>
  )
}
