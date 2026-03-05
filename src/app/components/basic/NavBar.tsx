import {ButtonLink} from '../ui/Button'

interface NavBarProps {
    user?: {
        email: string
        role: "student" | "moderator" | "admin"
    } | null
}
const NavBaractive="!bg-gray-100 border-x border-gray-300 text-gray-900 font-medium"

export function NavBar({ user }: NavBarProps) {
    return (
        <div className=" py-2 px-2 flex gap-2 text-lg">
            <ButtonLink to="/" variant="Navbar"  exact activeClassName={NavBaractive}>Home</ButtonLink>
            <ButtonLink to="/profile" variant="Navbar" activeClassName={NavBaractive}>Profile</ButtonLink>
            <ButtonLink to="/feedbacks" variant="Navbar" activeClassName={NavBaractive}>Feedbacks</ButtonLink>
            <ButtonLink to="/groups" variant="Navbar" activeClassName={NavBaractive}>Groups</ButtonLink>
            <div className="ml-auto flex items-center gap-2">
                {user ? (
                     <>
                        <span className="text-sm text-gray-600">{user.email}</span>
                        {user.role === 'admin' && (
                            <ButtonLink to="/admin" variant="Navbar" activeClassName={NavBaractive} >Admin</ButtonLink>
                         )}
                        <ButtonLink to="/logout" variant="danger" size='sm'>Logout</ButtonLink>
                     </>
                ) : (
                    <>
                        <ButtonLink to="/login" variant="Navbar">Login</ButtonLink>
                        <ButtonLink to="/signup" variant="primary">Signup</ButtonLink>
                    </>
                 )}
            </div>
        </div>
    )
}