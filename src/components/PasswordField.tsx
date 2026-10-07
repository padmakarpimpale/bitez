import { useId, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { passwordRules, passwordValidationError } from "../authValidation";

export function PasswordField({
  newPassword = false,
  label = "Password",
}: {
  newPassword?: boolean;
  label?: string;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  return (
    <div className="passwordField">
      <label htmlFor={id}>{label}</label>
      <div className="passwordInput">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          minLength={newPassword ? 12 : 1}
          // Existing accounts can keep using their current password.
          maxLength={newPassword ? 128 : undefined}
          aria-describedby={newPassword ? `${id}-rules` : undefined}
          required
          onChange={(event) => {
            const next = event.currentTarget.value;
            setValue(next);
            event.currentTarget.setCustomValidity(
              newPassword && next ? (passwordValidationError(next) ?? "") : "",
            );
          }}
        />
        <button
          type="button"
          className="passwordToggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
      {newPassword && (
        <ul
          className="passwordRules"
          id={`${id}-rules`}
          aria-label="Password requirements"
        >
          {passwordRules.map((rule) => (
            <li key={rule.label} className={rule.test(value) ? "met" : ""}>
              <Check size={14} aria-hidden="true" />
              <span>
                {rule.label}
                {rule.test(value) && <span className="srOnly"> — met</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
