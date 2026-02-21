// src/app/components/Navbar.tsx
import { Link, useRouter } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { Icon, IconLink, TextLink } from '../ui'
import { useAuth } from '../hooks'

// 配置数据
const navbarConfig = {
    left: {
        title: '校园平台',
        link: '/'
    },
    center: [
        { title: '群组', link: '/groups' },
        { title: '反馈', link: '/feedbacks' },
        { title: '公告', link: '/bulletins' },
        { title: '活动', link: '/activities' },
        { title: '商城', link: '/shop' }
    ],
    right: [
        { title: '个人中心', link: '/profile', icon: 'user' },
        { title: '消息', link: '/messages', icon: 'bell' },
        { title: '设置', link: '/settings', icon: 'settings' }
    ]
}

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)
    const [showNavbar, setShowNavbar] = useState(true)
    const lastScrollRef = useRef(0)
    const navbarRef = useRef<HTMLElement>(null)
    const portalRef = useRef<HTMLDivElement>(null)
    const { user, isAuthenticated } = useAuth()

    // 处理滚动
    useEffect(() => {
        const handleScroll = () => {
            const currentScroll = window.scrollY

            setIsScrolled(currentScroll > 20)

            if (currentScroll < 350 || currentScroll < lastScrollRef.current) {
                setShowNavbar(true)
            } else {
                setShowNavbar(false)
                // if (isOpen) setIsOpen(false)
            }

            lastScrollRef.current = currentScroll
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [isOpen])

    // click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!isOpen) return

            const target = e.target as Node
            if (
                navbarRef.current &&
                !navbarRef.current.contains(target) &&
                portalRef.current &&
                !portalRef.current.contains(target)
            ) {
                setIsOpen(false)
            }
        }

        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [isOpen])

    // loacte the open menu
    useEffect(() => {
        if (isOpen && navbarRef.current && portalRef.current) {
            const rect = navbarRef.current.getBoundingClientRect()
            portalRef.current.style.top = `${rect.bottom + 8}px`
        }
    }, [isOpen])

    const toggleMenu = () => {
        if (!isOpen) {
            setShowNavbar(true)
        }
        setIsOpen(!isOpen)
    }

    // click inside link
    const handleLinkClick = () => {
        if (isOpen) setIsOpen(false)
    }

    return (
        <>
            <header
                ref={navbarRef}
                className={`
          sticky top-0 z-50 block border-b border-border/50 transition-all duration-300
          ${isScrolled ? 'bg-card/92 border-border/92 shadow-md' : 'bg-background/80'}
          ${showNavbar ? 'translate-y-0' : '-translate-y-full'}
          ${isOpen ? 'translate-y-0 !shadow-md' : ''}
        `}
            >
                <nav className="flex items-center justify-between h-16 mx-auto px-6 md:px-8 max-w-7xl">
                    {/* Left: site title */}
                    <div className="flex-1">
                        <h2 className="m-0 text-xl font-semibold">
                            <Link
                                to={navbarConfig.left.link}
                                className="text-foreground no-underline transition-colors hover:text-accent"
                                onClick={handleLinkClick}
                            >
                                {navbarConfig.left.title}
                            </Link>
                        </h2>
                    </div>

                    {/* Center: main navigation - hidden on mobile */}
                    <div className="hidden md:flex flex-1 justify-center gap-1">
                        {navbarConfig.center.map((item) => (
                            <TextLink
                                href={item.link}
                                onClick={handleLinkClick}
                            >
                                {item.title}
                            </TextLink>
                        ))}
                    </div>

                    {/* Right: icon links - hidden on mobile */}
                    <div className="hidden md:flex flex-1 justify-end items-center gap-1">

                        {navbarConfig.right.map((item) => (
                            <IconLink
                                key={item.link}
                                to={item.link}
                                label={item.title}
                                icon={item.icon}
                                onClick={handleLinkClick}
                            />
                        ))}

                        {/* 主题切换按钮占位 */}
                        <button className="icon-button-base">
                            <span className="sr-only">切换主题</span>
                            <Icon name="sun" className="icon-base" />
                        </button>
                    </div>

                    {/* Mobile: 菜单按钮 */}
                    <div className="md:hidden flex items-center gap-2">

                        <button
                            onClick={toggleMenu}
                            aria-label="菜单"
                            className="icon-button-base p-2 rounded-md hover:bg-accent/10 transition-colors"
                        >
                            <Icon name='menu' className="icon-base w-6 h-6" />
                        </button>
                    </div>
                </nav>
            </header>

            {/* Mobile Menu Template */}
            <div
                ref={portalRef}
                className={`
                        md:hidden fixed left-4 right-4 z-40
                        flex flex-col rounded-xl shadow-md transition-all duration-500
                        ${isScrolled ? 'is-scrolled' : ''}
                        ${isOpen
                        ? 'opacity-100 visible pointer-events-auto max-h-[500px] p-0'
                        : 'opacity-0 invisible pointer-events-none max-h-0 p-0'
                    }
        `}
                style={{
                    top: navbarRef.current ? navbarRef.current.getBoundingClientRect().bottom + 8 : 0
                }}
            >
                <div className={`
          p-2 rounded-xl border
          ${isScrolled ? 'bg-card/92 border-border/92' : 'bg-card border-border/50'}
        `}>
                    {/* 移动端导航链接 */}
                    <div className="flex flex-col">
                        {navbarConfig.center.map((item, index) => (
                            <TextLink href={item.link} isMobile delay={index * 50}>
                                {item.title}
                            </TextLink>
                        ))}
                    </div>

                    <div className="h-px bg-gray-light mx-2 my-1"></div>

                    <div className="flex gap-2 px-1 pb-1">
                        {navbarConfig.right.map((item, index) => (
                            <IconLink
                                href={item.link}
                                label={item.title}
                                icon={item.icon}
                                isMobile
                                delay={(index + navbarConfig.center.length) * 50}
                            />
                        ))}

                        <button
                            onClick={() => { }}
                            className="icon-button-base p-2 rounded-md hover:bg-accent/10 transition-colors"
                            style={{
                                transitionDelay: isOpen
                                    ? `${(navbarConfig.right.length + navbarConfig.center.length) * 50}ms`
                                    : '0ms'
                            }}
                        >
                            <Icon name="sun" className="icon-base w-5 h-5" />
                        </button>
                    </div>

                    {!isAuthenticated && (
                        <>
                            <div className="h-px bg-gray-light mx-2 my-1"></div>
                            <div className="flex gap-2 px-1 pb-1">
                                <TextLink href="/login" onClick={handleLinkClick}>
                                    登录
                                </TextLink>
                                <TextLink href="/signup" onClick={handleLinkClick}>
                                    注册
                                </TextLink>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
