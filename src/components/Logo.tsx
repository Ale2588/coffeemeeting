import { Link } from "react-router";

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="CoffeeMeeting, home">
      Coffee<i>Meeting</i>
    </Link>
  );
}
