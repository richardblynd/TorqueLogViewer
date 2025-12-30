namespace TorqueLogViewer.Services;

public class SidebarService
{
    private bool _isCollapsed = false;

    public bool IsCollapsed
    {
        get => _isCollapsed;
        set
        {
            if (_isCollapsed != value)
            {
                _isCollapsed = value;
                OnStateChanged?.Invoke();
            }
        }
    }

    public event Action? OnStateChanged;

    public void ToggleSidebar()
    {
        IsCollapsed = !IsCollapsed;
    }
}
