import { Link } from '@tanstack/react-router'

interface NavBarProps {
    user?: {
        email: string
        role: "student" | "moderator" | "admin"
    } | null
}

export function NavBar({ user }: NavBarProps) {
    return (
        <div className="p-2 flex gap-2 text-lg">
            <Link
                to="/"
                activeProps={{
                    className: 'font-bold',
                }}
                activeOptions={{ exact: true }}
            >
                Home
            </Link>{' '}
            {/* <Link
                to="/posts"
                activeProps={{
                    className: 'font-bold',
                }}
            >
                Posts
            </Link> */}
            <Link
                to="/profile"
                activeProps={{
                    className: 'font-bold',
                }}
            >
                Profile
            </Link>
            <Link
                to="/feedbacks"
                activeProps={{
                    className: 'font-bold',
                }}
            >
                Feedbacks
            </Link>
            <div className="ml-auto">
                {user ? (
                    <>
                        <span className="mr-2">{user.email}</span>
                        {user.role === 'admin' && (
                            <Link to="/admin">Admin</Link>
                        )}
                        <Link to="/logout">Logout</Link>
                    </>
                ) : (
                    <>
                        <Link to="/login">Login</Link>
                        <Link to="/signup">Signup</Link>
                    </>
                )}
            </div>
        </div>
    )
}